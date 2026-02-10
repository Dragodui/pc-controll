import React from 'react';
import { View, Text, StatusBar, TouchableOpacity, ScrollView, ActivityIndicator, Modal, TextInput } from 'react-native';
import { Search, Monitor, Trash2, Plus } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../styles/theme';

export const DeviceList = ({ 
  devices, setDevices, isScanning, smartScan, handleDevicePress, 
  isAddModalVisible, setAddModalVisible, newIp, setNewIp, 
  newPort, setNewPort, newPass, setNewPass,
  isPassPromptVisible, setPassPromptVisible, promptPass, setPromptPass,
  savePasswordAndConnect, tempDevice
}) => {
  return (
    <View style={theme.container}>
      <StatusBar barStyle="light-content" />
      <View style={theme.listHeader}>
        <Text style={theme.mainTitle}>Devices</Text>
        <TouchableOpacity onPress={smartScan} disabled={isScanning}>
          {isScanning ? <ActivityIndicator color="#007AFF" /> : <Search color="#007AFF" size={28} />}
        </TouchableOpacity>
      </View>

      <ScrollView style={theme.scroll}>
        {devices.map(dev => (
          <TouchableOpacity key={dev.id} style={theme.devCard} onPress={() => handleDevicePress(dev)}>
            <View style={theme.devInfo}>
              <Monitor color={dev.online ? "#00ff00" : "#444"} size={30} />
              <View style={{marginLeft: 15}}>
                <Text style={theme.devNameText}>{dev.name}</Text>
                <Text style={theme.devIpText}>{dev.ip}:{dev.port}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => {
              const upd = devices.filter(d => d.id !== dev.id);
              setDevices(upd); AsyncStorage.setItem('devices', JSON.stringify(upd));
            }}><Trash2 color="#ff3b30" size={22} /></TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <TouchableOpacity style={theme.fab} onPress={() => setAddModalVisible(true)}>
        <Plus color="#fff" size={32} />
      </TouchableOpacity>
      
      {/* Pass Prompt Modal */}
      <Modal visible={isPassPromptVisible} animationType="fade" transparent>
        <View style={theme.modalFull}><View style={theme.modalBox}>
          <Text style={theme.modalLabel}>ENTER PASSWORD FOR {tempDevice?.name}</Text>
          <TextInput style={theme.input} secureTextEntry value={promptPass} onChangeText={setPromptPass} autoFocus />
          <TouchableOpacity style={[theme.mBtn, {backgroundColor: '#007AFF', width: '100%'}]} onPress={savePasswordAndConnect}>
            <Text style={{color:'#fff', fontWeight:'bold'}}>CONNECT</Text>
          </TouchableOpacity>
        </View></View>
      </Modal>

      {/* Add Device Modal */}
      <Modal visible={isAddModalVisible} animationType="slide" transparent>
        <View style={theme.modalFull}><View style={theme.modalBox}>
          <TextInput style={theme.input} placeholder="IP" value={newIp} onChangeText={setNewIp} keyboardType="numeric" />
          <TextInput style={theme.input} placeholder="Port" value={newPort} onChangeText={setNewPort} keyboardType="numeric" />
          <TextInput style={theme.input} placeholder="Pass" value={newPass} onChangeText={setNewPass} secureTextEntry />
          <TouchableOpacity style={[theme.mBtn, {backgroundColor: '#007AFF', width: '100%'}]} onPress={async () => {
            const d = { id: Date.now().toString(), name: 'Manual', ip: newIp, port: parseInt(newPort), pass: newPass, online: false };
            const upd = [...devices, d]; setDevices(upd);
            AsyncStorage.setItem('devices', JSON.stringify(upd)); setAddModalVisible(false);
          }}><Text style={{color:'#fff', fontWeight:'bold'}}>ADD</Text></TouchableOpacity>
        </View></View>
      </Modal>
    </View>
  );
};
