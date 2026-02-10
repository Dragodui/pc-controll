import React from 'react';
import { View, Text, StatusBar, TouchableOpacity, TextInput, Modal } from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { 
  ChevronLeft, Power, Languages, Keyboard as KeyboardIcon, Play, Copy, Download, Settings, Monitor,
  SkipBack, SkipForward, Lock
} from 'lucide-react-native';
import { theme } from '../styles/theme';

export const ControlScreen = ({
  activeDevice, status, ws, setCurrentScreen, setActiveDevice, send,
  inputRef, trackpadGesture,
  isMediaModalVisible, setMediaModalVisible,
  isSystemModalVisible, setSystemModalVisible,
  isSensModalVisible, setSensModalVisible,
  sensitivity, setSensitivity,
  scrollSensitivity, setScrollSensitivity,
  smoothFactor, setSmoothFactor
}) => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={theme.container}>
        <StatusBar barStyle="light-content" />
        <View style={theme.headerControl}>
          <TouchableOpacity onPress={() => { ws.current?.close(); setCurrentScreen('list'); setActiveDevice(null); }}>
            <ChevronLeft color="#fff" size={32} />
          </TouchableOpacity>
          <View style={{alignItems:'center'}}>
            <Text style={theme.brand}>{activeDevice?.name}</Text>
            <Text style={[theme.statusSmall, {color: status === 'Connected' ? '#00ff00' : '#ff4444'}]}>{status}</Text>
          </View>
          <TouchableOpacity onPress={() => setSystemModalVisible(true)}>
            <Power color="#ff3b30" size={28} />
          </TouchableOpacity>
        </View>

        <View style={theme.toolBar}>
          <TouchableOpacity onPress={() => send({type:'key_down', key:'command'})}><Languages color="#fff" size={24} /></TouchableOpacity>
          <TouchableOpacity onPress={() => inputRef.current?.focus()}><KeyboardIcon color="#fff" size={24} /></TouchableOpacity>
          <TouchableOpacity onPress={() => setMediaModalVisible(true)}><Play color="#fff" size={24} /></TouchableOpacity>
          <TouchableOpacity onPress={async () => {
             const text = await Clipboard.getStringAsync();
             if (text) send({ type: 'clipboard_set', value: text });
          }}><Copy color="#fff" size={24} /></TouchableOpacity>
          <TouchableOpacity onPress={() => send({ type: 'clipboard_get' })}><Download color="#fff" size={24} /></TouchableOpacity>
          <TouchableOpacity onPress={() => setSensModalVisible(true)}><Settings color="#fff" size={24} /></TouchableOpacity>
        </View>

        <TextInput ref={inputRef} style={theme.hiddenInput} onChangeText={(text) => {
          if (text) { send({ type: 'type_string', value: text }); inputRef.current?.clear(); }
        }} onKeyPress={(e) => {
          if(e.nativeEvent.key === 'Backspace') send({type:'tap', key:'backspace'});
          if(e.nativeEvent.key === 'Enter') send({type:'tap', key:'enter'});
        }} autoCorrect={false} autoCapitalize="none" />

        <GestureDetector gesture={trackpadGesture}>
          <View style={theme.touchpad}><Monitor color="#0a0a0a" size={120} /></View>
        </GestureDetector>
        
        <View style={theme.bottomPanel}>
           <TouchableOpacity onPress={() => { send({ type: 'key_down', key: 'alt' }); setTimeout(() => { send({ type: 'tap', key: 'tab' }); send({ type: 'key_up', key: 'alt' }); }, 100); }}>
            <View style={theme.switchBar}><Text style={theme.btnText}>ALT + TAB</Text></View>
          </TouchableOpacity>
           <TouchableOpacity onPress={() => send({type:'tap', key:'enter'})}>
            <View style={theme.switchBar}><Text style={theme.btnText}>Enter</Text></View>
          </TouchableOpacity>
        </View>

        {/* Media Modal */}
        <Modal visible={isMediaModalVisible} animationType="slide" transparent>
          <View style={theme.modalFull}>
            <View style={theme.modalBox}>
              <View style={theme.mediaRow}>
                <TouchableOpacity onPress={() => send({type:'media', value:'audio_prev'})}><SkipBack color="#fff" size={32} /></TouchableOpacity>
                <TouchableOpacity onPress={() => send({type:'media', value:'audio_play_pause'})}><Play color="#fff" size={48} /></TouchableOpacity>
                <TouchableOpacity onPress={() => send({type:'media', value:'audio_next'})}><SkipForward color="#fff" size={32} /></TouchableOpacity>
              </View>
              <TouchableOpacity style={[theme.mBtn, {backgroundColor: '#333', marginTop: 30}]} onPress={() => setMediaModalVisible(false)}><Text style={{color:'#fff'}}>CLOSE</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* System Modal */}
        <Modal visible={isSystemModalVisible} animationType="fade" transparent>
          <View style={theme.modalFull}>
            <View style={theme.modalBox}>
              <View style={theme.sysGrid}>
                <TouchableOpacity style={theme.sysBtn} onPress={() => send({type:'system', value:'shutdown'})}><Power color="#ff3b30" size={32} /><Text style={theme.sysText}>Power Off</Text></TouchableOpacity>
                <TouchableOpacity style={theme.sysBtn} onPress={() => send({type:'system', value:'lock'})}><Lock color="#fff" size={32} /><Text style={theme.sysText}>Lock</Text></TouchableOpacity>
              </View>
              <TouchableOpacity style={[theme.mBtn, {backgroundColor: '#333', marginTop: 20}]} onPress={() => setSystemModalVisible(false)}><Text style={{color:'#fff'}}>CANCEL</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Sensitivity Modal */}
        <Modal visible={isSensModalVisible} animationType="fade" transparent>
          <View style={theme.modalFull}>
            <View style={theme.modalBox}>
              <Text style={theme.modalLabel}>SENSITIVITY: {sensitivity.toFixed(1)}x</Text>
              <Slider style={{width:'100%', height:40}} minimumValue={0.5} maximumValue={5} value={sensitivity} onValueChange={setSensitivity} onSlidingComplete={val => AsyncStorage.setItem('sensitivity', val.toString())} minimumTrackTintColor="#007AFF" />
              <TouchableOpacity style={[theme.mBtn, {backgroundColor: '#007AFF', marginTop: 20}]} onPress={() => setSensModalVisible(false)}><Text style={{color:'#fff', fontWeight:'bold'}}>DONE</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </GestureHandlerRootView>
  );
};
