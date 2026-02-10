import React from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../../styles/theme';

export const AddDeviceModal = ({ 
  visible, onClose, devices, setDevices,
  newIp, setNewIp, newPort, setNewPort, newPass, setNewPass 
}) => {
  const handleAdd = async () => {
    const d = { 
      id: Date.now().toString(), 
      name: 'Manual', 
      ip: newIp, 
      port: parseInt(newPort), 
      pass: newPass, 
      online: false 
    };
    const upd = [...devices, d];
    setDevices(upd);
    await AsyncStorage.setItem('devices', JSON.stringify(upd));
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={theme.modalFull}>
        <View style={theme.modalBox}>
          <TextInput style={theme.input} placeholder="IP" value={newIp} onChangeText={setNewIp} keyboardType="numeric" />
          <TextInput style={theme.input} placeholder="Port" value={newPort} onChangeText={setNewPort} keyboardType="numeric" />
          <TextInput style={theme.input} placeholder="Pass" value={newPass} onChangeText={setNewPass} secureTextEntry />
          <TouchableOpacity style={[theme.mBtn, {backgroundColor: '#007AFF', width: '100%'}]} onPress={handleAdd}>
            <Text style={{color:'#fff', fontWeight:'bold'}}>ADD</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
