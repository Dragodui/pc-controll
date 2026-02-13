// @ts-nocheck
import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet, Text, View, StatusBar, TextInput,
  TouchableOpacity, Modal, ScrollView, ActivityIndicator, Alert, AppState
} from 'react-native';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import * as Haptics from 'expo-haptics';
import Zeroconf from 'react-native-zeroconf';
import {
  Keyboard as KeyboardIcon, Settings, Monitor, Trash2, Languages, Plus, ChevronLeft, Wifi, WifiOff, Search
} from 'lucide-react-native';

const SERVER_PORT = 1212;
const MDNS_TYPE = "remotepad";
const MDNS_PROTOCOL = "tcp";
const MDNS_DOMAIN = "local.";

export default function App() {
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

  const [isSwitcherActive, setIsSwitcherActive] = useState(false);
  const [lastOffset, setLastOffset] = useState(0);

  const ws = useRef(null);
  const inputRef = useRef(null);
  const prevInputText = useRef('');
  const pendingMove = useRef({ x: 0, y: 0 });
  const pendingScroll = useRef({ x: 0, y: 0 });
  const smoothMove = useRef({ x: 0, y: 0 });
  const smoothScroll = useRef({ x: 0, y: 0 });
  const zeroconfRef = useRef(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        if (activeDevice && (!ws.current || ws.current.readyState !== WebSocket.OPEN)) {
          console.log("Reconnecting to", activeDevice.ip);
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

  const mdnsDiscover = () => {
    return new Promise((resolve) => {
      if (!zeroconfRef.current) zeroconfRef.current = new Zeroconf();
      const zeroconf = zeroconfRef.current;
      const found = new Map();

      const onResolved = (service) => {
        const ip = service.addresses?.find(a => a.indexOf(':') === -1) || service.host;
        if (!ip) return;
        const id = `${ip}:${service.port}`;
        if (!found.has(id)) {
          found.set(id, { id, name: service.name, ip, port: service.port, pass: "", online: true });
        }
      };

      zeroconf.on("resolved", onResolved);
      zeroconf.scan(MDNS_TYPE, MDNS_PROTOCOL, MDNS_DOMAIN);
      setTimeout(() => {
        zeroconf.stop();
        zeroconf.removeListener("resolved", onResolved);
        resolve(Array.from(found.values()));
      }, 2000);
    });
  };

  const smartScan = async () => {
    setIsScanning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const mdnsDevices = await mdnsDiscover();
      const ipAddr = await Network.getIpAddressAsync();
      const subnet = ipAddr.substring(0, ipAddr.lastIndexOf('.'));
      const scanPromises = [];

      for (let i = 1; i < 255; i++) {
        const testIp = `${subnet}.${i}`;
        scanPromises.push(
          fetch(`http://${testIp}:${SERVER_PORT}/health`)
            .then(res => res.ok ? testIp : null).catch(() => null)
        );
      }
      const foundIps = (await Promise.all(scanPromises)).filter(ip => ip !== null);
      const subnetDevices = foundIps.map(ip => ({
        id: `${ip}:${SERVER_PORT}`, name: 'Subnet PC', ip, port: SERVER_PORT, pass: "", online: true
      }));

      setDevices(prev => {
        const combined = [...prev, ...mdnsDevices, ...subnetDevices];
        const unique = combined.reduce((acc, current) => {
          const exists = acc.find(item => item.ip === current.ip && item.port === current.port);
          if (!exists) return acc.concat([current]);
          return acc;
        }, []);
        AsyncStorage.setItem('devices', JSON.stringify(unique));
        return unique;
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert("Error", "Check network connection");
    } finally {
      setIsScanning(false);
    }
  };

  const handleDevicePress = (device) => {
    if (!device.pass || device.pass === "") {
      setTempDevice(device);
      setPassPromptVisible(true);
    } else {
      connectToDevice(device);
    }
  };

  const savePasswordAndConnect = async () => {
    const updatedDevice = { ...tempDevice, pass: promptPass };
    const updatedList = devices.map(d => d.id === tempDevice.id ? updatedDevice : d);
    setDevices(updatedList);
    await AsyncStorage.setItem('devices', JSON.stringify(updatedList));
    setPassPromptVisible(false);
    setPromptPass('');
    connectToDevice(updatedDevice);
  };

  const connectToDevice = (device) => {
    if (ws.current) ws.current.close();
    setActiveDevice(device);
    ws.current = new WebSocket(`ws://${device.ip}:${device.port}/ws`);
    ws.current.onopen = () => { setStatus('Connected'); setCurrentScreen('control'); };
    ws.current.onclose = () => setStatus('Offline');
    ws.current.onerror = () => setStatus('Error');
  };

  const send = (data) => {
    if (ws.current?.readyState === WebSocket.OPEN && activeDevice) {
      ws.current.send(JSON.stringify({ ...data, token: activeDevice.pass }));
    }
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
    }
  };

  const switchLang = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    send({ type: 'key_down', key: 'command' });
    send({ type: 'tap', key: 'space' });
    send({ type: 'key_up', key: 'command' });
  };

  // Smoothing Loop
  useEffect(() => {
    const interval = setInterval(() => {
      if (ws.current?.readyState !== WebSocket.OPEN) return;
      const move = pendingMove.current;
      const scroll = pendingScroll.current;
      pendingMove.current = { x: 0, y: 0 }; pendingScroll.current = { x: 0, y: 0 };

      if (move.x !== 0 || move.y !== 0) {
        const alpha = 1 - smoothFactor;
        smoothMove.current.x = smoothMove.current.x * smoothFactor + move.x * alpha;
        smoothMove.current.y = smoothMove.current.y * smoothFactor + move.y * alpha;
        send({ type: 'move', x: smoothMove.current.x, y: smoothMove.current.y });
      }
      if (scroll.y !== 0) {
        const alpha = 1 - smoothFactor;
        smoothScroll.current.y = smoothScroll.current.y * smoothFactor + scroll.y * alpha;
        send({ type: 'scroll', x: 0, y: smoothScroll.current.y });
      }
    }, 16);
    return () => clearInterval(interval);
  }, [smoothFactor, deadzone, activeDevice]);

  // Gestures
  const moveGesture = Gesture.Pan().minPointers(1).maxPointers(1).onChange((e) => {
    pendingMove.current.x += e.changeX * sensitivity;
    pendingMove.current.y += e.changeY * sensitivity;
  });

  const scrollGesture = Gesture.Pan().minPointers(2).maxPointers(2).onChange((e) => {
    pendingScroll.current.y += e.changeY * scrollSensitivity;
  });

  const leftClickGesture = Gesture.Tap().minPointers(1).onEnd(() => {
    send({ type: 'click', button: 'left' });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  });

  const rightClickGesture = Gesture.Tap().minPointers(2).onEnd(() => {
    send({ type: 'click', button: 'right' });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  });

  const trackpadGesture = Gesture.Simultaneous(
    Gesture.Exclusive(moveGesture, leftClickGesture),
    Gesture.Exclusive(scrollGesture, rightClickGesture)
  );

  const switcherGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onBegin(() => {
      altTabStep.current = 0;
      send({ type: 'key_down', key: 'alt' });
      send({ type: 'tap', key: 'tab' });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    })
    .onChange((e) => {
      const step = Math.round(e.translationX / 70);
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
    .onEnd(() => {
      send({ type: 'key_up', key: 'alt' });
    })
    .onFinalize(() => {
      send({ type: 'key_up', key: 'alt' });
    });

  if (currentScreen === 'list') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.listHeader}>
          <Text style={styles.mainTitle}>Devices</Text>
          <TouchableOpacity onPress={smartScan} disabled={isScanning}>
            {isScanning ? <ActivityIndicator color="#007AFF" /> : <Search color="#007AFF" size={28} />}
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.scroll}>
          {devices.map(dev => (
            <TouchableOpacity key={dev.id} style={styles.devCard} onPress={() => handleDevicePress(dev)}>
              <View style={styles.devInfo}>
                <Monitor color={dev.online ? "#00ff00" : "#444"} size={30} />
                <View style={{ marginLeft: 15 }}>
                  <Text style={styles.devNameText}>{dev.name}</Text>
                  <Text style={styles.devIpText}>{dev.ip}:{dev.port}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => {
                const upd = devices.filter(d => d.id !== dev.id);
                setDevices(upd); AsyncStorage.setItem('devices', JSON.stringify(upd));
              }}><Trash2 color="#ff3b30" size={22} /></TouchableOpacity>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.fab} onPress={() => setAddModalVisible(true)}><Plus color="#fff" size={32} /></TouchableOpacity>

        <Modal visible={isPassPromptVisible} animationType="fade" transparent>
          <View style={styles.modalFull}><View style={styles.modalBox}>
            <Text style={styles.modalLabel}>ENTER PASSWORD FOR {tempDevice?.name}</Text>
            <TextInput style={styles.input} secureTextEntry value={promptPass} onChangeText={setPromptPass} autoFocus />
            <TouchableOpacity style={[styles.mBtn, { backgroundColor: '#007AFF', width: '100%' }]} onPress={savePasswordAndConnect}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>CONNECT</Text>
            </TouchableOpacity>
          </View></View>
        </Modal>

        <Modal visible={isAddModalVisible} animationType="slide" transparent>
          <View style={styles.modalFull}><View style={styles.modalBox}>
            <TextInput style={styles.input} placeholder="IP" value={newIp} onChangeText={setNewIp} keyboardType="numeric" />
            <TextInput style={styles.input} placeholder="Port" value={newPort} onChangeText={setNewPort} keyboardType="numeric" />
            <TextInput style={styles.input} placeholder="Pass" value={newPass} onChangeText={setNewPass} secureTextEntry />
            <TouchableOpacity style={[styles.mBtn, { backgroundColor: '#007AFF', width: '100%' }]} onPress={async () => {
              const d = { id: Date.now().toString(), name: 'Manual', ip: newIp, port: parseInt(newPort), pass: newPass, online: false };
              const upd = [...devices, d]; setDevices(upd);
              AsyncStorage.setItem('devices', JSON.stringify(upd)); setAddModalVisible(false);
            }}><Text style={{ color: '#fff', fontWeight: 'bold' }}>ADD</Text></TouchableOpacity>
          </View></View>
        </Modal>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.headerControl}>
          <TouchableOpacity onPress={() => { ws.current?.close(); setCurrentScreen('list'); setActiveDevice(null); }}>
            <ChevronLeft color="#fff" size={32} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.brand}>{activeDevice?.name}</Text>
            <Text style={[styles.statusSmall, { color: status === 'Connected' ? '#00ff00' : '#ff4444' }]}>{status}</Text>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity onPress={switchLang} style={{ marginRight: 20 }}><Languages color="#fff" size={24} /></TouchableOpacity>
            <TouchableOpacity onPress={() => inputRef.current?.focus()} style={{ marginRight: 20 }}><KeyboardIcon color="#fff" size={24} /></TouchableOpacity>
            <TouchableOpacity onPress={() => setSensModalVisible(true)}><Settings color="#fff" size={24} /></TouchableOpacity>
          </View>
        </View>

        <TextInput ref={inputRef} style={styles.hiddenInput} onChangeText={handleType} onKeyPress={(e) => {
          if (e.nativeEvent.key === 'Backspace') send({ type: 'tap', key: 'backspace' });
          if (e.nativeEvent.key === 'Enter') send({ type: 'tap', key: 'enter' });
        }} autoCorrect={false} autoCapitalize="none" />

        <GestureDetector gesture={trackpadGesture}>
          <View style={styles.touchpad}><Monitor color="#0a0a0a" size={120} /></View>
        </GestureDetector>

        <View style={styles.bottomPanel}>
          <GestureDetector gesture={switcherGesture}>
            <View style={styles.switchBar}><Text style={styles.btnText}>ALT + TAB</Text></View>
          </GestureDetector>

          <TouchableOpacity onPress={() => send({ type: 'tap', key: 'enter' })}>
            <View style={styles.switchBar}><Text style={styles.btnText}>Enter</Text></View>
          </TouchableOpacity>
        </View>

        <Modal visible={isSensModalVisible} animationType="fade" transparent>
          <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={styles.modalFull}>
            <View style={styles.modalBox}>
              <Text style={styles.modalLabel}>SENSITIVITY: {sensitivity.toFixed(1)}x</Text>
              <Slider style={{ width: '100%', height: 40 }} minimumValue={0.5} maximumValue={5} value={sensitivity} onValueChange={setSensitivity} onSlidingComplete={val => AsyncStorage.setItem('sensitivity', val.toString())} minimumTrackTintColor="#007AFF" />

              <Text style={styles.modalLabel}>SCROLL SPEED: {scrollSensitivity.toFixed(1)}x</Text>
              <Slider style={{ width: '100%', height: 40 }} minimumValue={0.1} maximumValue={3} value={scrollSensitivity} onValueChange={setScrollSensitivity} onSlidingComplete={val => AsyncStorage.setItem('scrollSensitivity', val.toString())} minimumTrackTintColor="#007AFF" />

              <Text style={styles.modalLabel}>SMOOTHING: {smoothFactor.toFixed(2)}</Text>
              <Slider style={{ width: '100%', height: 40 }} minimumValue={0} maximumValue={0.9} value={smoothFactor} onValueChange={setSmoothFactor} onSlidingComplete={val => AsyncStorage.setItem('smoothFactor', val.toString())} minimumTrackTintColor="#007AFF" />
              <TouchableOpacity style={[styles.mBtn, { backgroundColor: '#007AFF', width: '100%', marginTop: 20 }]} onPress={() => setSensModalVisible(false)}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>DONE</Text>
              </TouchableOpacity>
            </View>
          </View>
          </GestureHandlerRootView>
        </Modal>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', paddingTop: 50 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 25, alignItems: 'center' },
  mainTitle: { color: '#fff', fontSize: 32, fontWeight: 'bold' },
  scroll: { flex: 1, paddingHorizontal: 20 },
  devCard: { backgroundColor: '#0a0a0a', padding: 20, borderRadius: 25, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  devInfo: { flexDirection: 'row', alignItems: 'center' },
  devNameText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  devIpText: { color: '#444', fontSize: 13 },
  fab: { position: 'absolute', right: 30, bottom: 40, backgroundColor: '#007AFF', width: 64, height: 64, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  headerControl: { flexDirection: 'row', justifyContent: 'space-between', padding: 25, alignItems: 'center' },
  brand: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  statusSmall: { fontSize: 10, textTransform: 'uppercase' },
  touchpad: { flex: 1, margin: 20, borderRadius: 50, backgroundColor: '#050505', justifyContent: 'center', alignItems: 'center' },
  bottomPanel: { paddingBottom: 40, paddingHorizontal: 20, display: "flex", flexDirection: "column", gap: 20 },
  switchBar: { backgroundColor: '#111', height: 70, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  modalFull: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#111', width: '85%', padding: 25, borderRadius: 30 },
  modalLabel: { color: '#444', fontSize: 10, marginBottom: 8, fontWeight: 'bold', marginTop: 10 },
  input: { backgroundColor: '#1a1a1a', color: '#fff', padding: 15, borderRadius: 15, marginBottom: 15 },
  mBtn: { padding: 15, borderRadius: 15, alignItems: 'center' },
  hiddenInput: { opacity: 0, position: 'absolute' }
});