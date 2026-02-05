import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet, Text, View, StatusBar, TextInput,
  TouchableOpacity, Modal
} from 'react-native';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SERVER_IP = '192.168.0.47';
const WS_URL = `ws://${SERVER_IP}:1488/ws`;

export default function App() {
  const [status, setStatus] = useState('Connecting...');
  const [sensitivity, setSensitivity] = useState(1.5);
  const [isSettingsVisible, setSettingsVisible] = useState(false);
  const ws = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    loadSettings();
    connect();
    return () => ws.current?.close();
  }, []);

  const loadSettings = async () => {
    try {
      const savedValue = await AsyncStorage.getItem('sensitivity');
      if (savedValue !== null) {
        setSensitivity(parseFloat(savedValue));
      }
    } catch (e) {
      console.log('Failed to load settings', e);
    }
  };

  const saveSettings = async (value) => {
    try {
      await AsyncStorage.setItem('sensitivity', value.toString());
    } catch (e) {
      console.log('Failed to save settings', e);
    }
  };

  const connect = () => {
    ws.current = new WebSocket(WS_URL);
    ws.current.onopen = () => setStatus('Connected');
    ws.current.onclose = () => {
      setStatus('Disconnected. Reconnecting...');
      setTimeout(connect, 3000);
    };
  };

  const send = (data) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    }
  };

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

  const composed = Gesture.Exclusive(panGesture, tapGesture);

  const handleTextChange = (text) => {
    if (text.length > 0) {
      send({
        type: 'type_string',
        value: text
      });

      setTimeout(() => {
        inputRef.current?.clear();
      }, 10);
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
          <Text style={styles.status}>{status}</Text>
          <View style={styles.navButtons}>
            <TouchableOpacity onPress={() => inputRef.current?.focus()} style={styles.iconButton}>
              <Text style={{ fontSize: 24 }}>⌨️</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSettingsVisible(true)} style={styles.iconButton}>
              <Text style={{ fontSize: 24 }}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TextInput
          ref={inputRef}
          style={{ height: 0, width: 0, opacity: 0, position: 'absolute' }}
          onChangeText={handleTextChange}
          onKeyPress={handleKeyPress}
          autoCorrect={false}
          autoCapitalize="none"
          keyboardType="default"
          submitBehavior={"blurAndSubmit"}
        />

        <GestureDetector gesture={composed}>
          <View style={styles.touchpad} collapsable={false}>
            <Text style={styles.label}>TOUCHPAD</Text>
          </View>
        </GestureDetector>

        <Modal visible={isSettingsVisible} animationType="fade" transparent={true}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Sensitivity</Text>

              <Text style={styles.valText}>{sensitivity.toFixed(1)}x</Text>

              <Slider
                style={{ width: 250, height: 40 }}
                minimumValue={0.5}
                maximumValue={5.0}
                step={0.1}
                value={sensitivity}
                onValueChange={(val) => setSensitivity(val)}
                onSlidingComplete={saveSettings}
                minimumTrackTintColor="#007AFF"
                maximumTrackTintColor="#444"
                thumbTintColor="#007AFF"
              />

              <TouchableOpacity
                onPress={() => setSettingsVisible(false)}
                style={styles.closeBtn}
              >
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
  header: {
    paddingTop: 50, paddingHorizontal: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
  },
  status: { color: '#00ff00', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  navButtons: { flexDirection: 'row' },
  iconButton: { marginLeft: 20, padding: 5 },
  touchpad: {
    flex: 1, margin: 20, marginBottom: 40, borderRadius: 30, borderWidth: 1,
    borderColor: '#222', backgroundColor: '#0a0a0a',
    justifyContent: 'center', alignItems: 'center'
  },
  label: { color: '#1a1a1a', fontSize: 32, fontWeight: '900', letterSpacing: 4 },
  modalContainer: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.9)' },
  modalContent: { margin: 30, padding: 30, backgroundColor: '#111', borderRadius: 25, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  modalTitle: { color: '#fff', fontSize: 18, marginBottom: 10, fontWeight: 'bold' },
  valText: { color: '#007AFF', fontSize: 32, fontWeight: 'bold', marginBottom: 20 },
  closeBtn: { marginTop: 30, paddingVertical: 12, paddingHorizontal: 40, backgroundColor: '#007AFF', borderRadius: 15 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});