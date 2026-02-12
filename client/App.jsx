// @ts-nocheck
import React, { useEffect, useState, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';

// Internal Imports
import { SERVER_PORT } from './src/constants/config';
import { useRemote } from './src/hooks/useRemote';
import { useDiscovery } from './src/hooks/useDiscovery';
import { DeviceList } from './src/screens/DeviceList';
import { ControlScreen } from './src/screens/ControlScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('list');
  const [devices, setDevices] = useState([]);
  const [activeDevice, setActiveDevice] = useState(null);
  const [status, setStatus] = useState('Offline');

  // Modals Visibility
  const [isAddModalVisible, setAddModalVisible] = useState(false);
  const [isSensModalVisible, setSensModalVisible] = useState(false);
  const [isPassPromptVisible, setPassPromptVisible] = useState(false);
  const [isMediaModalVisible, setMediaModalVisible] = useState(false);
  const [isSystemModalVisible, setSystemModalVisible] = useState(false);

  // Form States
  const [newIp, setNewIp] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newPort, setNewPort] = useState(SERVER_PORT.toString());
  const [promptPass, setPromptPass] = useState('');
  const [tempDevice, setTempDevice] = useState(null);

  // Settings
  const [sensitivity, setSensitivity] = useState(1.5);
  const [scrollSensitivity, setScrollSensitivity] = useState(0.5);
  const [smoothFactor, setSmoothFactor] = useState(0.7);
  
  // Custom Hooks
  const { isScanning, smartScan } = useDiscovery(setDevices);
  const { ws, connectToDevice, send } = useRemote(activeDevice, setStatus, setCurrentScreen);

  // Refs for gestures
  const inputRef = useRef(null);
  const pendingMove = useRef({ x: 0, y: 0 });
  const pendingScroll = useRef({ x: 0, y: 0 });
  const smoothMove = useRef({ x: 0, y: 0 });
  const smoothScroll = useRef({ x: 0, y: 0 });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const saved = await Promise.all([
      AsyncStorage.getItem('devices'),
      AsyncStorage.getItem('sensitivity'),
      AsyncStorage.getItem('scrollSensitivity'),
      AsyncStorage.getItem('smoothFactor')
    ]);
    if (saved[0]) setDevices(JSON.parse(saved[0]));
    if (saved[1]) setSensitivity(parseFloat(saved[1]));
    if (saved[2]) setScrollSensitivity(parseFloat(saved[2]));
    if (saved[3]) setSmoothFactor(parseFloat(saved[3]));
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
  }, [smoothFactor, activeDevice]);

  // Gestures Logic
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

  if (currentScreen === 'list') {
    return (
      <DeviceList 
        devices={devices} setDevices={setDevices}
        isScanning={isScanning} smartScan={smartScan}
        handleDevicePress={(device) => {
          if (!device.pass) { setTempDevice(device); setPassPromptVisible(true); }
          else { setActiveDevice(device); connectToDevice(device); }
        }}
        isAddModalVisible={isAddModalVisible} setAddModalVisible={setAddModalVisible}
        newIp={newIp} setNewIp={setNewIp} newPort={newPort} setNewPort={setNewPort}
        newPass={newPass} setNewPass={setNewPass}
        isPassPromptVisible={isPassPromptVisible} setPassPromptVisible={setPassPromptVisible}
        promptPass={promptPass} setPromptPass={setPromptPass}
        savePasswordAndConnect={async () => {
          const updated = { ...tempDevice, pass: promptPass };
          const list = devices.map(d => d.id === tempDevice.id ? updated : d);
          setDevices(list); await AsyncStorage.setItem('devices', JSON.stringify(list));
          setPassPromptVisible(false); setPromptPass(''); setActiveDevice(updated); connectToDevice(updated);
        }}
        tempDevice={tempDevice}
      />
    );
  }

  return (
    <ControlScreen 
      activeDevice={activeDevice} status={status} ws={ws} send={send}
      setCurrentScreen={setCurrentScreen} setActiveDevice={setActiveDevice}
      inputRef={inputRef} trackpadGesture={trackpadGesture}
      isMediaModalVisible={isMediaModalVisible} setMediaModalVisible={setMediaModalVisible}
      isSystemModalVisible={isSystemModalVisible} setSystemModalVisible={setSystemModalVisible}
      isSensModalVisible={isSensModalVisible} setSensModalVisible={setSensModalVisible}
      sensitivity={sensitivity} setSensitivity={setSensitivity}
      scrollSensitivity={scrollSensitivity} setScrollSensitivity={setScrollSensitivity}
      smoothFactor={smoothFactor} setSmoothFactor={setSmoothFactor}
    />
  );
}