import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet, Text, View, StatusBar, TextInput,
  TouchableOpacity, Modal
} from 'react-native';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

const SERVER_IP = '192.168.0.47';
const WS_URL = `ws://${SERVER_IP}:1488/ws`;

export default function App() {
  const [status, setStatus] = useState('Connecting...');
  const [sensitivity, setSensitivity] = useState(1.5);
  const [isSettingsVisible, setSettingsVisible] = useState(false);
  const [isSwitcherActive, setIsSwitcherActive] = useState(false);
  const [lastOffset, setLastOffset] = useState(0);
  
  const ws = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    init();
    return () => ws.current?.close();
  }, []);

  const init = async () => {
    await loadSettings();
    connect();
  };

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem('sensitivity');
      if (saved) setSensitivity(parseFloat(saved));
    } catch (e) { console.error(e); }
  };

  const saveSettings = async (val) => {
    try { await AsyncStorage.setItem('sensitivity', val.toString()); } 
    catch (e) { console.error(e); }
  };

  const connect = () => {
    ws.current = new WebSocket(WS_URL);
    ws.current.onopen = () => setStatus('Connected');
    ws.current.onclose = () => {
      setStatus('Reconnecting...');
      setTimeout(connect, 3000);
    };
  };

  const send = (data) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    }
  };

  const startSwitching = () => {
    setIsSwitcherActive(true);
    send({ type: 'key_down', key: 'alt' });
    setTimeout(() => send({ type: 'tap', key: 'tab' }), 50);
  };

  const stopSwitching = () => {
    setIsSwitcherActive(false);
    send({ type: 'key_up', key: 'alt' });
  };

  // Main Trackpad Gestures
  const panGesture = Gesture.Pan()
    .onChange((event) => {
      if (event.changeX !== undefined && event.changeY !== undefined) {
        send({
          type: 'move',
          x: event.changeX * sensitivity,
          y: event.changeY * sensitivity,
        });
      }
    });

  const tapGesture = Gesture.Tap().onEnd(() => {
    send({ type: 'click', button: 'left' });
  });

  const trackpadGesture = Gesture.Exclusive(panGesture, tapGesture);

  // Switcher Swipe Gesture
  const switcherGesture = Gesture.Pan()
  .onStart(() => {
    setLastOffset(0); // Reset tracking
    startSwitching(); // Alt Down + Tab
  })
  .onUpdate((event) => {
    const threshold = 50; // Distance in pixels for one "step"
    const diff = event.translationX - lastOffset;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        // Swipe Right -> Next app
        send({ type: 'tap', key: 'tab' });
      } else {
        // Swipe Left -> Previous app (Shift+Tab)
        send({ type: 'key_down', key: 'shift' });
        send({ type: 'tap', key: 'tab' });
        send({ type: 'key_up', key: 'shift' });
      }
      
      // Update anchor point to current position
      setLastOffset(event.translationX);
      
      if (Haptics) Haptics.selectionAsync();
    }
  })
  .onEnd(() => {
    stopSwitching(); // Alt Up
  });

  const handleTextChange = (text) => {
    if (text.length > 0) {
      send({ type: 'type_string', value: text });
      setTimeout(() => inputRef.current?.clear(), 10);
    }
  };

  const handleKeyPress = (e) => {
    const key = e.nativeEvent.key;
    if (key === 'Backspace') send({ type: 'tap', key: 'backspace' });
    if (key === 'Enter') send({ type: 'tap', key: 'enter' });
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />

        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>Pop!_Remote</Text>
            <Text style={styles.status}>{status}</Text>
          </View>
          <View style={styles.navButtons}>
            <TouchableOpacity onPress={() => inputRef.current?.focus()} style={styles.iconButton}>
              <Text style={{ fontSize: 26 }}>⌨️</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSettingsVisible(true)} style={styles.iconButton}>
              <Text style={{ fontSize: 26 }}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          onChangeText={handleTextChange}
          onKeyPress={handleKeyPress}
          autoCorrect={false}
          autoCapitalize="none"
        />

        <GestureDetector gesture={trackpadGesture}>
          <View style={styles.touchpad} collapsable={false}>
            <Text style={styles.label}>TRACKPAD</Text>
          </View>
        </GestureDetector>

        <View style={styles.bottomPanel}>
          <GestureDetector gesture={switcherGesture}>
            <View 
                style={[styles.switchBar, isSwitcherActive && styles.activeBar]}
                collapsable={false}
            >
              <Text style={styles.btnText}>
                {isSwitcherActive ? "← SLIDE TO SWITCH →" : "HOLD & SLIDE FOR ALT+TAB"}
              </Text>
            </View>
          </GestureDetector>
        </View>

        <Modal visible={isSettingsVisible} animationType="slide" transparent={true}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Sensitivity</Text>
              <Text style={styles.valText}>{sensitivity.toFixed(1)}x</Text>
              <Slider
                style={{ width: 280, height: 50 }}
                minimumValue={0.5}
                maximumValue={5.0}
                step={0.1}
                value={sensitivity}
                onValueChange={setSensitivity}
                onSlidingComplete={saveSettings}
                minimumTrackTintColor="#007AFF"
                maximumTrackTintColor="#444"
                thumbTintColor="#007AFF"
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
  status: { color: '#00ff00', fontSize: 10, textTransform: 'uppercase', marginTop: 2 },
  navButtons: { flexDirection: 'row' },
  iconButton: { marginLeft: 20, padding: 5 },
  hiddenInput: { height: 0, width: 0, opacity: 0, position: 'absolute' },
  touchpad: { flex: 1, margin: 20, marginTop: 30, borderRadius: 40, backgroundColor: '#080808', borderWidth: 1, borderColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
  label: { color: '#151515', fontSize: 32, fontWeight: '900', letterSpacing: 10 },
  bottomPanel: { paddingBottom: 50, paddingHorizontal: 20 },
  switchBar: { 
    backgroundColor: '#111', 
    height: 70, 
    borderRadius: 25, 
    borderWidth: 1, 
    borderColor: '#222', 
    justifyContent: 'center', 
    alignItems: 'center',
    width: '100%'
  },
  activeBar: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  btnText: { color: '#fff', fontSize: 14, fontWeight: 'bold', letterSpacing: 1 },
  modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.85)' },
  modalContent: { backgroundColor: '#111', padding: 40, borderTopLeftRadius: 30, borderTopRightRadius: 30, alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  modalTitle: { color: '#888', fontSize: 16, marginBottom: 10 },
  valText: { color: '#007AFF', fontSize: 48, fontWeight: 'bold', marginBottom: 10 },
  closeBtn: { marginTop: 20, paddingVertical: 15, paddingHorizontal: 60, backgroundColor: '#007AFF', borderRadius: 20 },
});