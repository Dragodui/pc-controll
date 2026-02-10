import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { Play, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react-native';
import { theme } from '../../styles/theme';

export const MediaModal = ({ visible, onClose, send }) => {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={theme.modalFull}>
        <View style={theme.modalBox}>
          <View style={theme.mediaRow}>
            <TouchableOpacity onPress={() => send({type:'media', value:'audio_prev'})}><SkipBack color="#fff" size={32} /></TouchableOpacity>
            <TouchableOpacity onPress={() => send({type:'media', value:'audio_play_pause'})}><Play color="#fff" size={48} /></TouchableOpacity>
            <TouchableOpacity onPress={() => send({type:'media', value:'audio_next'})}><SkipForward color="#fff" size={32} /></TouchableOpacity>
          </View>
          <View style={[theme.mediaRow, {marginTop: 30}]}>
            <TouchableOpacity onPress={() => send({type:'media', value:'audio_vol_down'})}><VolumeX color="#fff" size={32} /></TouchableOpacity>
            <TouchableOpacity onPress={() => send({type:'media', value:'audio_mute'})}><Volume2 color="#fff" size={32} /></TouchableOpacity>
            <TouchableOpacity onPress={() => send({type:'media', value:'audio_vol_up'})}><Volume2 color="#fff" size={32} /></TouchableOpacity>
          </View>
          <TouchableOpacity style={[theme.mBtn, {backgroundColor: '#333', width: '100%', marginTop: 30}]} onPress={onClose}>
            <Text style={{color:'#fff'}}>CLOSE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
