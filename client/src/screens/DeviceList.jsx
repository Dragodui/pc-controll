import React from 'react';
import { View, Text, StatusBar, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Search, Monitor, Trash2, Plus } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../styles/theme';

// Modals
import { AddDeviceModal } from '../components/modals/AddDeviceModal';
import { PasswordModal } from '../components/modals/PasswordModal';

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
      
      <PasswordModal 
        visible={isPassPromptVisible}
        deviceName={tempDevice?.name}
        promptPass={promptPass}
        setPromptPass={setPromptPass}
        onConnect={savePasswordAndConnect}
      />

      <AddDeviceModal 
        visible={isAddModalVisible}
        onClose={() => setAddModalVisible(false)}
        devices={devices}
        setDevices={setDevices}
        newIp={newIp} setNewIp={setNewIp}
        newPort={newPort} setNewPort={setNewPort}
        newPass={newPass} setNewPass={setNewPass}
      />
    </View>
  );
};