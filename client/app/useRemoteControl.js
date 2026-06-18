import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, PermissionsAndroid, Platform } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import * as Haptics from 'expo-haptics';
import Zeroconf from 'react-native-zeroconf';

const SERVER_PORT = 1212;
const MDNS_TYPE = 'remotepad';
const MDNS_PROTOCOL = 'tcp';
const MDNS_DOMAIN = 'local.';

export function useRemoteControl() {
  const [currentScreen, setCurrentScreen] = useState('list');
  const [devices, setDevices] = useState([]);
  const [activeDevice, setActiveDevice] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [isSensModalVisible, setSensModalVisible] = useState(false);
  const [isPassPromptVisible, setPassPromptVisible] = useState(false);

  const [newIp, setNewIp] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newPort, setNewPort] = useState(SERVER_PORT.toString());
  const [promptPass, setPromptPass] = useState('');
  const [tempDevice, setTempDevice] = useState(null);

  const [status, setStatus] = useState('Offline');
  const [sensitivity, setSensitivity] = useState(1.5);
  const [scrollSensitivity, setScrollSensitivity] = useState(0.5);
  const [smoothFactor, setSmoothFactor] = useState(0.7);
  const [deadzone, setDeadzone] = useState(0.6);

  const altTabStep = useRef(0);
  const ws = useRef(null);
  const inputRef = useRef(null);
  const prevInputText = useRef('');
  const pendingMove = useRef({ x: 0, y: 0 });
  const pendingScroll = useRef({ x: 0, y: 0 });
  const scrollAccum = useRef(0);
  const smoothMove = useRef({ x: 0, y: 0 });
  const zeroconfRef = useRef(null);
  const appState = useRef(AppState.currentState);

  const send = (data) => {
    if (ws.current?.readyState === WebSocket.OPEN && activeDevice) {
      ws.current.send(JSON.stringify({ ...data, token: activeDevice.pass }));
    }
  };

  const connectToDevice = (device) => {
    if (ws.current) ws.current.close();
    setActiveDevice(device);
    ws.current = new WebSocket(`ws://${device.ip}:${device.port}/ws`);
    ws.current.onopen = () => {
      setStatus('Connected');
      setCurrentScreen('control');
    };
    ws.current.onclose = () => setStatus('Offline');
    ws.current.onerror = () => setStatus('Error');
  };

  const ensureAndroidDiscoveryPermissions = async () => {
    if (Platform.OS !== 'android') return true;

    const permissions = [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
    if (Platform.Version >= 33 && PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES) {
      permissions.push(PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES);
    }

    const results = await PermissionsAndroid.requestMultiple(permissions);
    return permissions.every((permission) => results[permission] === PermissionsAndroid.RESULTS.GRANTED);
  };

  const checkOnlineStatus = async (list) => {
    const updated = await Promise.all(list.map(async (dev) => {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 1000);
        const resp = await fetch(`http://${dev.ip}:${dev.port}/health`, { signal: controller.signal });
        clearTimeout(id);
        return { ...dev, online: resp.ok };
      } catch {
        return { ...dev, online: false };
      }
    }));
    setDevices(updated);
  };

  const loadData = async () => {
    const savedDevices = await AsyncStorage.getItem('devices');
    const savedSens = await AsyncStorage.getItem('sensitivity');
    const savedScrollSens = await AsyncStorage.getItem('scrollSensitivity');
    const savedSmooth = await AsyncStorage.getItem('smoothFactor');
    const savedDeadzone = await AsyncStorage.getItem('deadzone');

    if (savedSens) setSensitivity(parseFloat(savedSens));
    if (savedScrollSens) setScrollSensitivity(parseFloat(savedScrollSens));
    if (savedSmooth) setSmoothFactor(parseFloat(savedSmooth));
    if (savedDeadzone) setDeadzone(parseFloat(savedDeadzone));
    if (savedDevices) {
      const parsed = JSON.parse(savedDevices);
      setDevices(parsed);
      checkOnlineStatus(parsed);
    }
  };

  const mdnsDiscover = () => {
    return new Promise((resolve) => {
      if (!zeroconfRef.current) zeroconfRef.current = new Zeroconf();
      const zeroconf = zeroconfRef.current;
      const found = new Map();

      const onResolved = (service) => {
        const ip = service.addresses?.find((address) => address.indexOf(':') === -1) || service.host;
        if (!ip) return;
        const id = `${ip}:${service.port}`;
        if (!found.has(id)) {
          found.set(id, { id, name: service.name, ip, port: service.port, pass: '', online: true });
        }
      };

      zeroconf.on('resolved', onResolved);
      zeroconf.scan(MDNS_TYPE, MDNS_PROTOCOL, MDNS_DOMAIN);
      setTimeout(() => {
        zeroconf.stop();
        zeroconf.removeListener('resolved', onResolved);
        resolve(Array.from(found.values()));
      }, 2000);
    });
  };

  const smartScan = async () => {
    setIsScanning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const hasPermissions = await ensureAndroidDiscoveryPermissions();
      if (!hasPermissions) {
        Alert.alert('Permission needed', 'Android needs location or nearby devices permission for local network discovery.');
        return;
      }

      const mdnsDevices = await mdnsDiscover();
      const ipAddr = await Network.getIpAddressAsync();
      const subnet = ipAddr.substring(0, ipAddr.lastIndexOf('.'));
      const scanPromises = [];

      for (let i = 1; i < 255; i++) {
        const testIp = `${subnet}.${i}`;
        scanPromises.push(fetch(`http://${testIp}:${SERVER_PORT}/health`).then((res) => (res.ok ? testIp : null)).catch(() => null));
      }

      const foundIps = (await Promise.all(scanPromises)).filter((ip) => ip !== null);
      const subnetDevices = foundIps.map((ip) => ({
        id: `${ip}:${SERVER_PORT}`,
        name: 'Subnet PC',
        ip,
        port: SERVER_PORT,
        pass: '',
        online: true,
      }));

      setDevices((prev) => {
        const combined = [...prev, ...mdnsDevices, ...subnetDevices];
        const unique = combined.reduce((acc, current) => {
          const exists = acc.find((item) => item.ip === current.ip && item.port === current.port);
          if (!exists) return acc.concat([current]);
          return acc;
        }, []);
        AsyncStorage.setItem('devices', JSON.stringify(unique));
        return unique;
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert('Error', 'Check network connection');
    } finally {
      setIsScanning(false);
    }
  };

  const handleDevicePress = (device) => {
    if (!device.pass || device.pass === '') {
      setTempDevice(device);
      setPassPromptVisible(true);
      return;
    }
    connectToDevice(device);
  };

  const savePasswordAndConnect = async () => {
    const updatedDevice = { ...tempDevice, pass: promptPass };
    const updatedList = devices.map((device) => (device.id === tempDevice.id ? updatedDevice : device));
    setDevices(updatedList);
    await AsyncStorage.setItem('devices', JSON.stringify(updatedList));
    setPassPromptVisible(false);
    setPromptPass('');
    connectToDevice(updatedDevice);
  };

  const addManualDevice = async () => {
    const device = {
      id: Date.now().toString(),
      name: 'Manual',
      ip: newIp,
      port: parseInt(newPort, 10),
      pass: newPass,
      online: false,
    };
    const updated = [...devices, device];
    setDevices(updated);
    await AsyncStorage.setItem('devices', JSON.stringify(updated));
    setAddModalVisible(false);
  };

  const removeDevice = async (deviceId) => {
    const updated = devices.filter((device) => device.id !== deviceId);
    setDevices(updated);
    await AsyncStorage.setItem('devices', JSON.stringify(updated));
  };

  const disconnectToList = () => {
    ws.current?.close();
    setCurrentScreen('list');
    setActiveDevice(null);
  };

  const handleType = (text) => {
    const prev = prevInputText.current;
    if (text.length > prev.length) {
      const newChars = text.slice(prev.length);
      send({ type: 'type_string', value: newChars });
    }
    prevInputText.current = text;
    if (text.length > 30) {
      inputRef.current?.clear();
      prevInputText.current = '';
    }
  };

  const switchLang = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    send({ type: 'key_down', key: 'command' });
    send({ type: 'tap', key: 'space' });
    send({ type: 'key_up', key: 'command' });
  };

  const persistSetting = (key) => (value) => AsyncStorage.setItem(key, value.toString());

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (activeDevice && (!ws.current || ws.current.readyState !== WebSocket.OPEN)) {
          connectToDevice(activeDevice);
        }
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [activeDevice]);

  useEffect(() => {
    loadData();
    return () => {
      ws.current?.close();
      zeroconfRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (ws.current?.readyState !== WebSocket.OPEN) return;
      const move = pendingMove.current;
      const scroll = pendingScroll.current;
      pendingMove.current = { x: 0, y: 0 };
      pendingScroll.current = { x: 0, y: 0 };

      if (move.x !== 0 || move.y !== 0) {
        const alpha = 1 - smoothFactor;
        smoothMove.current.x = smoothMove.current.x * smoothFactor + move.x * alpha;
        smoothMove.current.y = smoothMove.current.y * smoothFactor + move.y * alpha;
        send({ type: 'move', x: smoothMove.current.x, y: smoothMove.current.y });
      }

      if (scroll.y !== 0) {
        scrollAccum.current += scroll.y;
      }
      if (scrollAccum.current !== 0) {
        const pixelsPerTick = 18;
        const ticks = Math.trunc(scrollAccum.current / pixelsPerTick);
        if (ticks !== 0) {
          const clamped = Math.max(-3, Math.min(3, ticks));
          send({ type: 'scroll', x: 0, y: clamped });
          scrollAccum.current -= ticks * pixelsPerTick;
        }
        scrollAccum.current *= 0.85;
        if (Math.abs(scrollAccum.current) < 0.5) scrollAccum.current = 0;
      }
    }, 16);

    return () => clearInterval(interval);
  }, [smoothFactor, activeDevice]);

  const moveGesture = Gesture.Pan().minPointers(1).maxPointers(1).onChange((event) => {
    pendingMove.current.x += event.changeX * sensitivity;
    pendingMove.current.y += event.changeY * sensitivity;
  });

  const scrollGesture = Gesture.Pan().minPointers(2).maxPointers(2).onChange((event) => {
    pendingScroll.current.y += event.changeY * scrollSensitivity;
  });

  const leftClickGesture = Gesture.Tap().minPointers(1).onEnd(() => {
    send({ type: 'click', button: 'left' });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  });

  const rightClickGesture = Gesture.Tap().minPointers(2).maxDuration(250).maxDistance(15).onEnd(() => {
    send({ type: 'click', button: 'right' });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  });

  const trackpadGesture = Gesture.Simultaneous(
    Gesture.Exclusive(moveGesture, leftClickGesture),
    Gesture.Exclusive(scrollGesture, rightClickGesture),
  );

  const switcherGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onBegin(() => {
      altTabStep.current = 0;
      send({ type: 'key_down', key: 'alt' });
      send({ type: 'tap', key: 'tab' });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    })
    .onChange((event) => {
      const step = Math.round(event.translationX / 70);
      if (step !== altTabStep.current) {
        const diff = step - altTabStep.current;
        if (diff > 0) {
          for (let i = 0; i < diff; i++) send({ type: 'tap', key: 'tab' });
        } else {
          for (let i = 0; i < -diff; i++) {
            send({ type: 'key_down', key: 'shift' });
            send({ type: 'tap', key: 'tab' });
            send({ type: 'key_up', key: 'shift' });
          }
        }
        altTabStep.current = step;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    })
    .onFinalize(() => {
      send({ type: 'key_up', key: 'alt' });
    });

  return {
    activeDevice,
    addManualDevice,
    currentScreen,
    devices,
    disconnectToList,
    handleDevicePress,
    handleType,
    inputRef,
    isAddModalVisible,
    isPassPromptVisible,
    isScanning,
    isSensModalVisible,
    newIp,
    newPass,
    newPort,
    persistSetting,
    promptPass,
    removeDevice,
    savePasswordAndConnect,
    scrollSensitivity,
    send,
    sensitivity,
    setAddModalVisible,
    setNewIp,
    setNewPass,
    setNewPort,
    setPassPromptVisible,
    setPromptPass,
    setScrollSensitivity,
    setSensModalVisible,
    setSensitivity,
    setSmoothFactor,
    smartScan,
    smoothFactor,
    status,
    switchLang,
    switcherGesture,
    tempDevice,
    trackpadGesture,
  };
}
