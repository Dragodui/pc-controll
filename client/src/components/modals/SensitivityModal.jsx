import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../../styles/theme';

export const SensitivityModal = ({ 
  visible, onClose, 
  sensitivity, setSensitivity, 
  scrollSensitivity, setScrollSensitivity, 
  smoothFactor, setSmoothFactor 
}) => {
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={theme.modalFull}>
        <View style={theme.modalBox}>
          <Text style={theme.modalLabel}>SENSITIVITY: {sensitivity.toFixed(1)}x</Text>
          <Slider 
            style={{width:'100%', height:40}} 
            minimumValue={0.5} maximumValue={5} 
            value={sensitivity} onValueChange={setSensitivity} 
            onSlidingComplete={val => AsyncStorage.setItem('sensitivity', val.toString())} 
            minimumTrackTintColor="#007AFF" 
          />
          
          <Text style={theme.modalLabel}>SCROLL SPEED: {scrollSensitivity.toFixed(1)}x</Text>
          <Slider 
            style={{width:'100%', height:40}} 
            minimumValue={0.1} maximumValue={3} 
            value={scrollSensitivity} onValueChange={setScrollSensitivity} 
            onSlidingComplete={val => AsyncStorage.setItem('scrollSensitivity', val.toString())} 
            minimumTrackTintColor="#007AFF" 
          />

          <Text style={theme.modalLabel}>SMOOTHING: {smoothFactor.toFixed(2)}</Text>
          <Slider 
            style={{width:'100%', height:40}} 
            minimumValue={0} maximumValue={0.9} 
            value={smoothFactor} onValueChange={setSmoothFactor} 
            onSlidingComplete={val => AsyncStorage.setItem('smoothFactor', val.toString())} 
            minimumTrackTintColor="#007AFF" 
          />
          <TouchableOpacity style={[theme.mBtn, {backgroundColor: '#007AFF', width: '100%', marginTop: 20}]} onPress={onClose}>
            <Text style={{color:'#fff', fontWeight:'bold'}}>DONE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};
