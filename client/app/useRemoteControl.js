import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, PermissionsAndroid, Platform } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import * as Haptics from 'expo-haptics';
import { canDiscover, hostDevice, mdnsDiscover, passwordFromURL } from './discovery';

const SERVER_PORT = 1212;

// React Native's Alert is a no-op in the browser, so the web build would show
// nothing at all. Route messages to the native dialog or to window.alert.
const notify = (title, message) => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
};

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
  const authenticated = useRef(false);
  const rejected = useRef(false);
  const inputRef = useRef(null);
  const prevInputText = useRef('');
  const pendingMove = useRef({ x: 0, y: 0 });
  const pendingScroll = useRef({ x: 0, y: 0 });
  const scrollAccum = useRef(0);
  const smoothMove = useRef({ x: 0, y: 0 });
  const appState = useRef(AppState.currentState);

  const send = (data) => {
    if (ws.current?.readyState === WebSocket.OPEN && activeDevice) {
      ws.current.send(JSON.stringify({ ...data, token: activeDevice.pass }));
    }
  };

  // The socket opens for anyone; the server confirms the password with an
  // auth_ok reply. Until that arrives the trackpad stays hidden, so a wrong
  // password is reported instead of silently dropping every command.
  const connectToDevice = (device) => {
    if (ws.current) ws.current.close();
    authenticated.current = false;
    rejected.current = false;
    setActiveDevice(device);
    setStatus('Connecting');

    const socket = new WebSocket(`ws://${device.ip}:${device.port}/ws`);
    ws.current = socket;

    socket.onopen = () => socket.send(JSON.stringify({ type: 'auth', token: device.pass }));

    socket.onmessage = (event) => {
      let reply;
      try {
        reply = JSON.parse(event.data);
      } catch {
        return;
      }
      if (reply.type === 'auth_ok') {
        authenticated.current = true;
        setStatus('Connected');
        setCurrentScreen('control');
      } else if (reply.type === 'auth_error') {
        rejected.current = true;
        socket.close();
        handleWrongPassword(device);
      }
    };

    socket.onclose = () => {
      setStatus('Offline');
      if (!authenticated.current && !rejected.current) {
        setCurrentScreen('list');
        notify('Not connected', `${device.ip}:${device.port} did not answer.`);
      }
    };
    socket.onerror = () => setStatus('Error');
  };

  // Forget the password that was refused so the next tap asks for it again.
  // Uses the functional form: this can fire before `devices` state settles,
  // for example when a scanned QR auto-connects on load.
  const handleWrongPassword = (device) => {
    setCurrentScreen('list');
    setActiveDevice(null);
    setStatus('Offline');
    setDevices((prev) => {
      const updated = prev.map((item) => (item.id === device.id ? { ...item, pass: '' } : item));
      AsyncStorage.setItem('devices', JSON.stringify(updated));
      return updated;
    });
    notify('Wrong password', 'The PC refused that password. Check it in the PC Control window.');
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
    let list = savedDevices ? JSON.parse(savedDevices) : [];
    // Web build: the server that serves this page is a device by definition.
    const host = hostDevice();
    let autoConnect = null;
    if (host) {
      const scannedPass = passwordFromURL();
      const known = list.find((d) => d.ip === host.ip && d.port === host.port);
      const device = { ...host, ...known, pass: scannedPass || known?.pass || '' };
      list = [device, ...list.filter((d) => d !== known)];
      await AsyncStorage.setItem('devices', JSON.stringify(list));
      // Scanned the QR: skip the device list and open the trackpad straight away.
      if (scannedPass) autoConnect = device;
    }
    if (list.length) {
      setDevices(list);
      checkOnlineStatus(list);
    }
    if (autoConnect) connectToDevice(autoConnect);
  };

  const smartScan = async () => {
    setIsScanning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const hasPermissions = await ensureAndroidDiscoveryPermissions();
      if (!hasPermissions) {
        notify('Permission needed', 'Android needs location or nearby devices permission for local network discovery.');
        return;
      }

      const mdnsDevices = await mdnsDiscover();
      // Browsers do not expose the local IP; scan the subnet of the page's host instead.
      const ipAddr = canDiscover ? await Network.getIpAddressAsync() : hostDevice()?.ip;
      const scanPromises = [];

      if (ipAddr && /^\d+\.\d+\.\d+\.\d+$/.test(ipAddr)) {
        const subnet = ipAddr.substring(0, ipAddr.lastIndexOf('.'));
        for (let i = 1; i < 255; i++) {
          const testIp = `${subnet}.${i}`;
          scanPromises.push(fetch(`http://${testIp}:${SERVER_PORT}/health`).then((res) => (res.ok ? testIp : null)).catch(() => null));
        }
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
      notify('Error', 'Check network connection');
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
