import { useState, useRef, useEffect } from 'react';
import { Alert, AppState } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

export const useRemote = (activeDevice, setStatus, setCurrentScreen) => {
  const ws = useRef(null);
  const appState = useRef(AppState.currentState);

  const connectToDevice = (device) => {
    if (ws.current) ws.current.close();
    ws.current = new WebSocket(`ws://${device.ip}:${device.port}/ws`);
    
    ws.current.onopen = () => {
      setStatus('Connected');
      setCurrentScreen('control');
    };
    
    ws.current.onclose = () => setStatus('Offline');
    ws.current.onerror = () => setStatus('Error');
    
    ws.current.onmessage = async (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'clipboard') {
        await Clipboard.setStringAsync(data.value);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Clipboard", "PC Clipboard copied to Phone");
      }
    };
  };

  const send = (data) => {
    if (ws.current?.readyState === WebSocket.OPEN && activeDevice) {
      ws.current.send(JSON.stringify({ ...data, token: activeDevice.pass }));
    }
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) && 
        nextAppState === 'active'
      ) {
        if (activeDevice && (!ws.current || ws.current.readyState !== WebSocket.OPEN)) {
          connectToDevice(activeDevice);
        }
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [activeDevice]);

  return { ws, connectToDevice, send };
};
