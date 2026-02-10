import React from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity } from 'react-native';
import { theme } from '../../styles/theme';

export const PasswordModal = ({ visible, deviceName, promptPass, setPromptPass, onConnect }) => {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={theme.modalFull}>
        <View style={theme.modalBox}>
          <Text style={theme.modalLabel}>ENTER PASSWORD FOR {deviceName}</Text>
          <TextInput style={theme.input} secureTextEntry value={promptPass} onChangeText={setPromptPass} autoFocus />
          <TouchableOpacity style={[theme.mBtn, {backgroundColor: '#007AFF', width: '100%'}]} onPress={onConnect}>
            <Text style={{color:'#fff', fontWeight:'bold'}}>CONNECT</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
