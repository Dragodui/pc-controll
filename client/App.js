import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet, Text, View, StatusBar, TextInput,
  TouchableOpacity, Modal, ScrollView
} from 'react-native';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Keyboard, Settings, Monitor, Trash2, Languages } from 'lucide-react-native';

const SERVER_PORT = 1488;

export default function App() {
  const [status, setStatus] = useState('Offline');
  const [devices, setDevices] = useState([]);
  const [activeIp, setActiveIp] = useState(null);
  const [ipInput, setIpInput] = useState('');
  const [sensitivity, setSensitivity] = useState(1.5);
  const [isSettingsVisible, setSettingsVisible] = useState(false);
  const [isSwitcherActive, setIsSwitcherActive] = useState(false);
  const [lastOffset, setLastOffset] = useState(0);
  
  // State for the hidden keyboard input to prevent text accumulation
  const [keyboardValue, setKeyboardValue] = useState('');
  
  const ws = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    initApp();
    return () => ws.current?.close();
  }, []);

  const initApp = async () => {
    const savedDevices = await AsyncStorage.getItem('devices');
    const savedSens = await AsyncStorage.getItem('sensitivity');
    const lastIp = await AsyncStorage.getItem('lastIp');
    
    if (savedSens) setSensitivity(parseFloat(savedSens));
    if (savedDevices) setDevices(JSON.parse(savedDevices));
    if (lastIp) {
      setActiveIp(lastIp);
      connectToServer(lastIp);
    } else {
      setSettingsVisible(true);
    }
  };

  const connectToServer = (ip) => {
    if (!ip) return;
    if (ws.current) ws.current.close();
    setStatus(`Connecting...`);

    ws.current = new WebSocket(`ws://${ip}:${SERVER_PORT}/ws`);
    ws.current.onopen = () => {
      setStatus('Connected');
      setActiveIp(ip);
      AsyncStorage.setItem('lastIp', ip);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };
    ws.current.onerror = () => setStatus('Error');
    ws.current.onclose = () => setStatus('Offline');
  };

  const send = (data) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    }
  };

  const openKeyboard = () => {
    if (inputRef.current) {
      inputRef.current.blur();
      setTimeout(() => {
        inputRef.current.focus();
      }, 100);
    }
  };

  // Fixed: Use state to reset text and prevent "vlvlvldada" spam
  const handleKeyboardInput = (text) => {
    if (text.length > 0) {
      send({ type: 'type_string', value: text });
      setKeyboardValue(''); // Reset state
      inputRef.current?.clear(); // Force clear native
    }
  };

  const switchLanguage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    send({ type: 'key_down', key: 'command' });
    send({ type: 'tap', key: 'space' });
    send({ type: 'key_up', key: 'command' });
  };

  const startSwitching = () => {
    setIsSwitcherActive(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    send({ type: 'key_down', key: 'alt' });
    setTimeout(() => send({ type: 'tap', key: 'tab' }), 50);
  };

  const stopSwitching = () => {
    setIsSwitcherActive(false);
    send({ type: 'key_up', key: 'alt' });
  };

  const trackpadGesture = Gesture.Exclusive(
    Gesture.Pan().onChange((event) => {
      send({ type: 'move', x: event.changeX * sensitivity, y: event.changeY * sensitivity });
    }),
    Gesture.Tap().onEnd(() => {
      send({ type: 'click', button: 'left' });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    })
  );

  const switcherGesture = Gesture.Pan()
    .onStart(() => { setLastOffset(0); startSwitching(); })
    .onUpdate((event) => {
      const threshold = 80; 
      const diff = event.translationX - lastOffset;
      if (Math.abs(diff) > threshold) {
        if (diff > 0) send({ type: 'tap', key: 'tab' });
        else {
          send({ type: 'key_down', key: 'shift' });
          send({ type: 'tap', key: 'tab' });
          send({ type: 'key_up', key: 'shift' });
        }
        Haptics.selectionAsync();
        setLastOffset(event.translationX);
      }
    })
    .onEnd(stopSwitching);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />

        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>Pop!_Remote</Text>
            <Text style={[styles.status, { color: status === 'Connected' ? '#00ff00' : '#ff3b30' }]}>
              {status} {activeIp && `• ${activeIp}`}
            </Text>
          </View>
          <View style={styles.navButtons}>
            <TouchableOpacity onPress={switchLanguage} style={styles.iconButton}>
              <Languages color="#fff" size={24} />
            </TouchableOpacity>
            <TouchableOpacity onPress={openKeyboard} style={styles.iconButton}>
              <Keyboard color="#fff" size={24} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSettingsVisible(true)} style={styles.iconButton}>
              <Settings color="#fff" size={24} />
            </TouchableOpacity>
          </View>
        </View>

        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={keyboardValue}
          onChangeText={handleKeyboardInput}
          onKeyPress={(e) => {
            const key = e.nativeEvent.key;
            if (key === 'Backspace') send({ type: 'tap', key: 'backspace' });
            if (key === 'Enter') send({ type: 'tap', key: 'enter' });
          }}
          autoCorrect={false}
          autoCapitalize="none"
          blurOnSubmit={false}
          caretHidden={true}
        />

        <GestureDetector gesture={trackpadGesture}>
          <View style={styles.touchpad} collapsable={false}>
            <Monitor color="#151515" size={80} strokeWidth={1} />
          </View>
        </GestureDetector>

        <View style={styles.bottomPanel}>
          <GestureDetector gesture={switcherGesture}>
            <View style={[styles.switchBar, isSwitcherActive && styles.activeBar]} collapsable={false}>
              <Text style={styles.btnText}>
                {isSwitcherActive ? "← SLIDE TO NAVIGATE →" : "HOLD & SLIDE FOR ALT+TAB"}
              </Text>
            </View>
          </GestureDetector>
        </View>

        <Modal visible={isSettingsVisible} animationType="slide" transparent={true}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>DEVICES</Text>
              <ScrollView style={{ width: '100%', maxHeight: 150 }}>
                {devices.map(item => (
                  <View key={item.id} style={[styles.deviceItem, activeIp === item.ip && styles.activeItem]}>
                    <TouchableOpacity style={{flex: 1}} onPress={() => connectToServer(item.ip)}>
                      <Text style={styles.deviceName}>{item.name}</Text>
                      <Text style={styles.deviceIp}>{item.ip}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => {
                        const updated = devices.filter(d => d.id !== item.id);
                        setDevices(updated);
                        AsyncStorage.setItem('devices', JSON.stringify(updated));
                    }}>
                      <Trash2 color="#ff3b30" size={20} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>

              <TextInput 
                style={styles.ipInput}
                placeholder="PC IP Address"
                placeholderTextColor="#444"
                value={ipInput}
                onChangeText={setIpInput}
                keyboardType="numeric"
              />
              <TouchableOpacity style={styles.addBtn} onPress={async () => {
                  if(!ipInput) return;
                  const newD = { id: Date.now().toString(), name: 'Desktop', ip: ipInput };
                  const up = [...devices, newD];
                  setDevices(up);
                  await AsyncStorage.setItem('devices', JSON.stringify(up));
                  setIpInput('');
                  connectToServer(ipInput);
              }}>
                <Text style={styles.addBtnText}>Add PC</Text>
              </TouchableOpacity>

              <View style={styles.divider} />
              <Text style={styles.modalTitle}>SENSITIVITY: {sensitivity.toFixed(1)}x</Text>
              <Slider
                style={{ width: '100%', height: 40 }}
                minimumValue={0.5} maximumValue={5.0} step={0.1}
                value={sensitivity} onValueChange={setSensitivity}
                onSlidingComplete={(v) => AsyncStorage.setItem('sensitivity', v.toString())}
                minimumTrackTintColor="#007AFF" thumbTintColor="#007AFF"
              />
              <TouchableOpacity onPress={() => setSettingsVisible(false)} style={styles.closeBtn}>
                <Text style={styles.btnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { paddingTop: 60, paddingHorizontal: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  status: { fontSize: 10, textTransform: 'uppercase', marginTop: 2 },
  navButtons: { flexDirection: 'row' },
  iconButton: { marginLeft: 15, padding: 8, backgroundColor: '#111', borderRadius: 12 },
  hiddenInput: { height: 1, width: 1, opacity: 0, position: 'absolute', top: -10 },
  touchpad: { flex: 1, margin: 20, marginTop: 30, borderRadius: 40, backgroundColor: '#080808', borderWidth: 1, borderColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  bottomPanel: { paddingBottom: 50, paddingHorizontal: 20 },
  switchBar: { backgroundColor: '#111', height: 70, borderRadius: 25, borderWidth: 1, borderColor: '#222', justifyContent: 'center', alignItems: 'center', width: '100%' },
  activeBar: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  btnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.9)' },
  modalContent: { backgroundColor: '#111', padding: 30, borderTopLeftRadius: 30, borderTopRightRadius: 30, alignItems: 'center' },
  modalTitle: { color: '#444', fontSize: 12, fontWeight: 'bold', marginBottom: 15, alignSelf: 'flex-start' },
  deviceItem: { flexDirection: 'row', padding: 15, backgroundColor: '#161616', borderRadius: 15, marginBottom: 8, borderWidth: 1, borderColor: '#222', alignItems: 'center' },
  activeItem: { borderColor: '#007AFF' },
  deviceName: { color: '#fff', fontWeight: '600' },
  deviceIp: { color: '#666', fontSize: 11 },
  ipInput: { width: '100%', backgroundColor: '#1a1a1a', color: '#fff', padding: 15, borderRadius: 15, marginTop: 10 },
  addBtn: { width: '100%', backgroundColor: '#222', padding: 15, borderRadius: 15, marginTop: 10, alignItems: 'center' },
  addBtnText: { color: '#007AFF', fontWeight: 'bold' },
  divider: { height: 1, width: '100%', backgroundColor: '#222', marginVertical: 20 },
  closeBtn: { marginTop: 20, paddingVertical: 15, paddingHorizontal: 60, backgroundColor: '#007AFF', borderRadius: 20 },
});