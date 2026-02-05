import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet, Text, View, StatusBar, TextInput,
  TouchableOpacity, Modal, ScrollView, ActivityIndicator, Alert
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
  
  const [newIp, setNewIp] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newPort, setNewPort] = useState(SERVER_PORT.toString());
  const [status, setStatus] = useState('Offline');
  const [sensitivity, setSensitivity] = useState(1.5);
  const [scrollSensitivity, setScrollSensitivity] = useState(0.5);
  const [smoothFactor, setSmoothFactor] = useState(0.7);
  const [deadzone, setDeadzone] = useState(0.6);
  const [keyboardValue, setKeyboardValue] = useState('');
  const [isSwitcherActive, setIsSwitcherActive] = useState(false);
  const [lastOffset, setLastOffset] = useState(0);

  const ws = useRef(null);
  const inputRef = useRef(null);
  const pendingMove = useRef({ x: 0, y: 0 });
  const pendingScroll = useRef({ x: 0, y: 0 });
  const smoothMove = useRef({ x: 0, y: 0 });
  const smoothScroll = useRef({ x: 0, y: 0 });
  const zeroconfRef = useRef(null);

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

  const saveSens = async (val) => {
    setSensitivity(val);
    await AsyncStorage.setItem('sensitivity', val.toString());
  };

  const saveScrollSens = async (val) => {
    setScrollSensitivity(val);
    await AsyncStorage.setItem('scrollSensitivity', val.toString());
  };

  const saveSmoothFactor = async (val) => {
    setSmoothFactor(val);
    await AsyncStorage.setItem('smoothFactor', val.toString());
  };

  const saveDeadzone = async (val) => {
    setDeadzone(val);
    await AsyncStorage.setItem('deadzone', val.toString());
  };

  const checkOnlineStatus = async (list) => {
    const updated = await Promise.all(list.map(async (dev) => {
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 1500);
        const port = dev.port || SERVER_PORT;
        const resp = await fetch(`http://${dev.ip}:${port}/health`, { signal: controller.signal });
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
      if (!zeroconfRef.current) {
        zeroconfRef.current = new Zeroconf();
      }
      const zeroconf = zeroconfRef.current;
      const found = new Map();

      const pickAddress = (service) => {
        const addresses = service?.addresses || [];
        const ipv4 = addresses.find((addr) => addr && addr.indexOf(":") === -1);
        if (ipv4) return ipv4;
        if (service?.host) return service.host;
        return null;
      };

      const onResolved = (service) => {
        const ip = pickAddress(service);
        if (!ip) return;
        const port = service.port || SERVER_PORT;
        const id = `${ip}:${port}`;
        if (!found.has(id)) {
          found.set(id, {
            id,
            name: service.name || "Discovered PC",
            ip,
            port,
            pass: DEFAULT_PASS,
            online: true
          });
        }
      };

      const onError = () => {
        // mDNS errors are expected on some networks; fallback handles it.
      };

      zeroconf.on("resolved", onResolved);
      zeroconf.on("error", onError);
      zeroconf.scan(MDNS_TYPE, MDNS_PROTOCOL, MDNS_DOMAIN);

      setTimeout(() => {
        zeroconf.stop();
        zeroconf.removeListener("resolved", onResolved);
        zeroconf.removeListener("error", onError);
        resolve(Array.from(found.values()));
      }, 1500);
    });
  };

  const smartScan = async () => {
    setIsScanning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      let mdnsDevices = [];
      try {
        mdnsDevices = await mdnsDiscover();
      } catch {
        mdnsDevices = [];
      }

      if (mdnsDevices.length > 0) {
        setDevices((prev) => {
          const combined = [...prev, ...mdnsDevices];
          const unique = combined.filter((v, i, a) => {
            const vPort = v.port || SERVER_PORT;
            return a.findIndex((t) => t.ip === v.ip && (t.port || SERVER_PORT) === vPort) === i;
          });
          AsyncStorage.setItem('devices', JSON.stringify(unique));
          return unique;
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return;
      }

      const ipAddr = await Network.getIpAddressAsync();
      const subnet = ipAddr.substring(0, ipAddr.lastIndexOf('.'));
      const scanPromises = [];
      for (let i = 1; i < 255; i++) {
        const testIp = `${subnet}.${i}`;
        scanPromises.push(
          fetch(`http://${testIp}:${SERVER_PORT}/health`)
            .then(res => res.ok ? testIp : null)
            .catch(() => null)
        );
      }
      const foundIps = (await Promise.all(scanPromises)).filter(ip => ip !== null);
      if (foundIps.length > 0) {
        const newDevices = foundIps.map(ip => ({
          id: `${ip}:${SERVER_PORT}`, name: 'Discovered PC', ip: ip, port: SERVER_PORT, pass: DEFAULT_PASS, online: true
        }));
        setDevices(prev => {
          const combined = [...prev, ...newDevices];
          const unique = combined.filter((v, i, a) => {
            const vPort = v.port || SERVER_PORT;
            return a.findIndex(t => t.ip === v.ip && (t.port || SERVER_PORT) === vPort) === i;
          });
          AsyncStorage.setItem('devices', JSON.stringify(unique));
          return unique;
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e) {
      Alert.alert("Scan Error", "Check WiFi connection");
    } finally {
      setIsScanning(false);
    }
  };

  const connectToDevice = (device) => {
    if (ws.current) ws.current.close();
    setActiveDevice(device);
    const port = device.port || SERVER_PORT;
    ws.current = new WebSocket(`ws://${device.ip}:${port}/ws`);
    ws.current.onopen = () => {
      setStatus('Connected');
      setCurrentScreen('control');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };
    ws.current.onclose = () => setStatus('Offline');
    ws.current.onerror = () => setStatus('Error');
  };

  const send = (data) => {
    if (ws.current?.readyState === WebSocket.OPEN && activeDevice) {
      ws.current.send(JSON.stringify({ ...data, token: activeDevice.pass }));
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;

      const move = pendingMove.current;
      const scroll = pendingScroll.current;
      pendingMove.current = { x: 0, y: 0 };
      pendingScroll.current = { x: 0, y: 0 };

      if (move.x !== 0 || move.y !== 0) {
        const sm = smoothMove.current;
        const alpha = 1 - smoothFactor;
        const sx = sm.x * smoothFactor + move.x * alpha;
        const sy = sm.y * smoothFactor + move.y * alpha;
        smoothMove.current = { x: sx, y: sy };
        if (Math.abs(sx) >= deadzone || Math.abs(sy) >= deadzone) {
          send({ type: 'move', x: sx, y: sy });
        }
      }

      if (scroll.x !== 0 || scroll.y !== 0) {
        const ss = smoothScroll.current;
        const alpha = 1 - smoothFactor;
        const sx = ss.x * smoothFactor + scroll.x * alpha;
        const sy = ss.y * smoothFactor + scroll.y * alpha;
        smoothScroll.current = { x: sx, y: sy };
        if (Math.abs(sx) >= deadzone || Math.abs(sy) >= deadzone) {
          send({ type: 'scroll', x: sx, y: sy });
        }
      }
    }, 16);

    return () => clearInterval(interval);
  }, [smoothFactor, deadzone, activeDevice]);

  const handleType = (text) => {
    if (text) {
      send({ type: 'type_string', value: text });
      setKeyboardValue('');
      inputRef.current?.clear();
    }
  };

  const switchLang = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    send({ type: 'key_down', key: 'command' });
    send({ type: 'tap', key: 'space' });
    send({ type: 'key_up', key: 'command' });
  };

  const moveGesture = Gesture.Pan()
    .minPointers(1)
    .maxPointers(1)
    .onChange((e) => {
      pendingMove.current.x += e.changeX * sensitivity;
      pendingMove.current.y += e.changeY * sensitivity;
    });

  const scrollGesture = Gesture.Pan()
    .minPointers(2)
    .maxPointers(2)
    .onChange((e) => {
      pendingScroll.current.x += 0;
      pendingScroll.current.y += e.changeY * scrollSensitivity;
    });

  const leftClickGesture = Gesture.Tap()
    .numberOfTaps(1)
    .minPointers(1)
    .onEnd(() => {
      send({ type: 'click', button: 'left' });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    });

  const rightClickGesture = Gesture.Tap()
    .numberOfTaps(1)
    .minPointers(2)
    .onEnd(() => {
      send({ type: 'click', button: 'right' });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    });

  const trackpadGesture = Gesture.Simultaneous(
    Gesture.Exclusive(moveGesture, leftClickGesture),
    Gesture.Exclusive(scrollGesture, rightClickGesture)
  );

  const switcherGesture = Gesture.Pan()
    .onStart(() => { setLastOffset(0); setIsSwitcherActive(true); send({ type: 'key_down', key: 'alt' }); setTimeout(() => send({ type: 'tap', key: 'tab' }), 50); })
    .onUpdate((e) => {
      const threshold = 50; const diff = e.translationX - lastOffset;
      if (Math.abs(diff) > threshold) {
        if (diff > 0) send({ type: 'tap', key: 'tab' });
        else { send({ type: 'key_down', key: 'shift' }); send({ type: 'tap', key: 'tab' }); send({ type: 'key_up', key: 'shift' }); }
        Haptics.selectionAsync(); setLastOffset(e.translationX);
      }
    })
    .onEnd(() => { setIsSwitcherActive(false); send({ type: 'key_up', key: 'alt' }); });

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
            <TouchableOpacity key={dev.id} style={styles.devCard} onPress={() => connectToDevice(dev)}>
              <View style={styles.devInfo}>
                <Monitor color={dev.online ? "#00ff00" : "#444"} size={30} />
                <View style={{marginLeft: 15}}>
                  <Text style={styles.devNameText}>{dev.name}</Text>
                  <Text style={styles.devIpText}>{dev.ip}</Text>
                </View>
              </View>
              <View style={styles.devStatusRow}>
                {dev.online ? <Wifi color="#00ff00" size={18} /> : <WifiOff color="#ff3b30" size={18} />}
                <TouchableOpacity onPress={() => {
                  const upd = devices.filter(d => d.id !== dev.id);
                  setDevices(upd);
                  AsyncStorage.setItem('devices', JSON.stringify(upd));
                }} style={{marginLeft: 20}}><Trash2 color="#ff3b30" size={20} /></TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.fab} onPress={() => setAddModalVisible(true)}><Plus color="#fff" size={32} /></TouchableOpacity>
        <Modal visible={isAddModalVisible} animationType="slide" transparent>
          <View style={styles.modalFull}><View style={styles.modalBox}>
            <Text style={styles.modalLabel}>IP ADDRESS</Text>
            <TextInput style={styles.input} value={newIp} onChangeText={setNewIp} keyboardType="numeric" placeholder="192.168.x.x" placeholderTextColor="#444" />
            <Text style={styles.modalLabel}>PORT</Text>
            <TextInput style={styles.input} value={newPort} onChangeText={setNewPort} keyboardType="numeric" placeholder="1212" placeholderTextColor="#444" />
            <Text style={styles.modalLabel}>PASSWORD</Text>
            <TextInput style={styles.input} value={newPass} onChangeText={setNewPass} secureTextEntry placeholder="Server Password" placeholderTextColor="#444" />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={[styles.mBtn, {backgroundColor: '#222'}]} onPress={() => setAddModalVisible(false)}><Text style={{color:'#fff'}}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.mBtn, {backgroundColor: '#007AFF'}]} onPress={async () => {
                const parsedPort = parseInt(newPort, 10);
                const portValue = Number.isFinite(parsedPort) ? parsedPort : SERVER_PORT;
                const d = { id: Date.now().toString(), name: 'Desktop', ip: newIp, port: portValue, pass: newPass, online: false };
                const upd = [...devices, d]; setDevices(upd);
                await AsyncStorage.setItem('devices', JSON.stringify(upd));
                setAddModalVisible(false); checkOnlineStatus(upd);
              }}><Text style={{color:'#fff', fontWeight:'bold'}}>Add</Text></TouchableOpacity>
            </View>
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
          <TouchableOpacity onPress={() => {ws.current?.close(); setCurrentScreen('list');}}><ChevronLeft color="#fff" size={32} /></TouchableOpacity>
          <View style={{alignItems:'center'}}>
            <Text style={styles.brand}>{activeDevice?.name}</Text>
            <Text style={[styles.statusSmall, {color: status === 'Connected' ? '#00ff00' : '#ff4444'}]}>{status}</Text>
          </View>
          <View style={{ flexDirection:'row'}}>
            <TouchableOpacity onPress={switchLang} style={{marginRight: 30}}><Languages color="#fff" size={24} /></TouchableOpacity>
            <TouchableOpacity onPress={() => inputRef.current?.focus()} style={{marginRight: 30}}><KeyboardIcon color="#fff" size={24} /></TouchableOpacity>
            <TouchableOpacity onPress={() => setSensModalVisible(true)}><Settings color="#fff" size={24} /></TouchableOpacity>
          </View>
        </View>
        <TextInput ref={inputRef} style={styles.hiddenInput} value={keyboardValue} onChangeText={handleType} onKeyPress={(e) => {
          if(e.nativeEvent.key === 'Backspace') send({type:'tap', key:'backspace'});
          if(e.nativeEvent.key === 'Enter') send({type:'tap', key:'enter'});
        }} autoCorrect={false} autoCapitalize="none" />
        <GestureDetector gesture={trackpadGesture}><View style={styles.touchpad}><Monitor color="#0a0a0a" size={120} /></View></GestureDetector>
        <View style={styles.bottomPanel}><GestureDetector gesture={switcherGesture}><View style={[styles.switchBar, isSwitcherActive && styles.activeBar]}><Text style={styles.btnText}>ALT + TAB</Text></View></GestureDetector></View>
        <Modal visible={isSensModalVisible} animationType="fade" transparent>
          <View style={styles.modalFull}>
            <View style={styles.modalBox}>
              <Text style={styles.modalLabel}>MOUSE SENSITIVITY: {sensitivity.toFixed(1)}x</Text>
              <Slider style={{ width: '100%', height: 50 }} minimumValue={0.5} maximumValue={5.0} step={0.1} value={sensitivity} onValueChange={setSensitivity} onSlidingComplete={saveSens} minimumTrackTintColor="#007AFF" thumbTintColor="#007AFF" />
              <Text style={[styles.modalLabel, {marginTop: 20}]}>SCROLL SENSITIVITY: {scrollSensitivity.toFixed(1)}x</Text>
              <Slider style={{ width: '100%', height: 50 }} minimumValue={0.1} maximumValue={5.0} step={0.1} value={scrollSensitivity} onValueChange={setScrollSensitivity} onSlidingComplete={saveScrollSens} minimumTrackTintColor="#007AFF" thumbTintColor="#007AFF" />
              <Text style={[styles.modalLabel, {marginTop: 20}]}>SMOOTHING: {smoothFactor.toFixed(2)}</Text>
              <Slider style={{ width: '100%', height: 50 }} minimumValue={0.0} maximumValue={0.9} step={0.05} value={smoothFactor} onValueChange={setSmoothFactor} onSlidingComplete={saveSmoothFactor} minimumTrackTintColor="#007AFF" thumbTintColor="#007AFF" />
              <Text style={[styles.modalLabel, {marginTop: 20}]}>DEADZONE: {deadzone.toFixed(1)} px</Text>
              <Slider style={{ width: '100%', height: 50 }} minimumValue={0.0} maximumValue={3.0} step={0.1} value={deadzone} onValueChange={setDeadzone} onSlidingComplete={saveDeadzone} minimumTrackTintColor="#007AFF" thumbTintColor="#007AFF" />
              <TouchableOpacity style={[styles.mBtn, {backgroundColor: '#007AFF', width: '100%', marginTop: 20}]} onPress={() => setSensModalVisible(false)}><Text style={{color:'#fff', fontWeight:'bold'}}>Apply</Text></TouchableOpacity>
            </View>
          </View>
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
  devCard: { backgroundColor: '#0a0a0a', padding: 20, borderRadius: 25, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#1a1a1a' },
  devInfo: { flexDirection: 'row', alignItems: 'center' },
  devNameText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  devIpText: { color: '#444', fontSize: 13 },
  devStatusRow: { flexDirection: 'row', alignItems: 'center' },
  fab: { position: 'absolute', right: 30, bottom: 40, backgroundColor: '#007AFF', width: 64, height: 64, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  headerControl: { flexDirection: 'row', justifyContent: 'space-between', padding: 25, alignItems: 'center' },
  brand: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  statusSmall: { fontSize: 10, textTransform: 'uppercase' },
  touchpad: { flex: 1, margin: 20, borderRadius: 50, backgroundColor: '#050505', borderWidth: 1, borderColor: '#111', justifyContent: 'center', alignItems: 'center' },
  bottomPanel: { paddingBottom: 40, paddingHorizontal: 20 },
  switchBar: { backgroundColor: '#111', height: 70, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  activeBar: { backgroundColor: '#007AFF' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  modalFull: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#111', width: '85%', padding: 25, borderRadius: 30, borderWidth: 1, borderColor: '#222' },
  modalLabel: { color: '#444', fontSize: 10, marginBottom: 8, fontWeight: 'bold' },
  input: { backgroundColor: '#1a1a1a', color: '#fff', padding: 15, borderRadius: 15, marginBottom: 15 },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'space-between' },
  mBtn: { padding: 15, borderRadius: 15, width: '47%', alignItems: 'center' },
  hiddenInput: { opacity: 0, position: 'absolute' }
});
