import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { Power, RotateCcw, Lock, Moon } from 'lucide-react-native';
import { theme } from '../../styles/theme';

export const SystemModal = ({ visible, onClose, send }) => {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={theme.modalFull}>
        <View style={theme.modalBox}>
          <Text style={[theme.modalLabel, {textAlign:'center', fontSize: 16, marginBottom: 20}]}>SYSTEM ACTIONS</Text>
          <View style={theme.sysGrid}>
            <TouchableOpacity style={theme.sysBtn} onPress={() => send({type:'system', value:'shutdown'})}>
              <Power color="#ff3b30" size={32} /><Text style={theme.sysText}>Power Off</Text>
            </TouchableOpacity>
            <TouchableOpacity style={theme.sysBtn} onPress={() => send({type:'system', value:'restart'})}>
              <RotateCcw color="#007AFF" size={32} /><Text style={theme.sysText}>Restart</Text>
            </TouchableOpacity>
            <TouchableOpacity style={theme.sysBtn} onPress={() => send({type:'system', value:'lock'})}>
              <Lock color="#fff" size={32} /><Text style={theme.sysText}>Lock</Text>
            </TouchableOpacity>
            <TouchableOpacity style={theme.sysBtn} onPress={() => send({type:'system', value:'sleep'})}>
              <Moon color="#fff" size={32} /><Text style={theme.sysText}>Sleep</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[theme.mBtn, {backgroundColor: '#333', width: '100%', marginTop: 20}]} onPress={onClose}>
            <Text style={{color:'#fff'}}>CANCEL</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
