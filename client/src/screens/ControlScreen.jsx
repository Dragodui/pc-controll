import React from 'react';
import { View, Text, StatusBar, TouchableOpacity, TextInput } from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Clipboard from 'expo-clipboard';
import { 
  ChevronLeft, Power, Languages, Keyboard as KeyboardIcon, Play, Copy, Download, Settings, Monitor, LayoutGrid
} from 'lucide-react-native';
import { theme } from '../styles/theme';

// Modals
import { AppLauncherModal } from '../components/modals/AppLauncherModal';
import { MediaModal } from '../components/modals/MediaModal';
import { SystemModal } from '../components/modals/SystemModal';
import { SensitivityModal } from '../components/modals/SensitivityModal';

export const ControlScreen = ({
  activeDevice, status, ws, setCurrentScreen, setActiveDevice, send,
  inputRef, trackpadGesture, altTabGesture,
  isMediaModalVisible, setMediaModalVisible,
  isSystemModalVisible, setSystemModalVisible,
  isSensModalVisible, setSensModalVisible,
  sensitivity, setSensitivity,
  scrollSensitivity, setScrollSensitivity,
  smoothFactor, setSmoothFactor
}) => {
  const [isLauncherVisible, setLauncherVisible] = React.useState(false);
  const lastInputText = React.useRef('');

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
          <TouchableOpacity onPress={() => setLauncherVisible(true)}><LayoutGrid color="#fff" size={24} /></TouchableOpacity>
          <TouchableOpacity onPress={() => setMediaModalVisible(true)}><Play color="#fff" size={24} /></TouchableOpacity>
          <TouchableOpacity onPress={async () => {
             const text = await Clipboard.getStringAsync();
             if (text) send({ type: 'clipboard_set', value: text });
          }}><Copy color="#fff" size={24} /></TouchableOpacity>
          <TouchableOpacity onPress={() => send({ type: 'clipboard_get' })}><Download color="#fff" size={24} /></TouchableOpacity>
          <TouchableOpacity onPress={() => setSensModalVisible(true)}><Settings color="#fff" size={24} /></TouchableOpacity>
        </View>

        <TextInput ref={inputRef} style={theme.hiddenInput} onChangeText={(text) => {
          const prev = lastInputText.current;
          if (text.length > prev.length) {
            const newChars = text.slice(prev.length);
            send({ type: 'type_string', value: newChars });
          }
          lastInputText.current = text;
          if (text.length > 30) {
            inputRef.current?.clear();
            lastInputText.current = '';
          }
        }} onKeyPress={(e) => {
          if(e.nativeEvent.key === 'Backspace') {
            lastInputText.current = lastInputText.current.slice(0, -1);
            send({type:'tap', key:'backspace'});
          }
          if(e.nativeEvent.key === 'Enter') send({type:'tap', key:'enter'});
        }} autoCorrect={false} autoCapitalize="none" />

        <GestureDetector gesture={trackpadGesture}>
          <View style={theme.touchpad}><Monitor color="#0a0a0a" size={120} /></View>
        </GestureDetector>
        
        <View style={theme.bottomPanel}>
          <GestureDetector gesture={altTabGesture}>
            <View style={theme.switchBar}>
              <Text style={theme.btnText}>{'<'}  ALT + TAB  {'>'}</Text>
            </View>
          </GestureDetector>
          <TouchableOpacity onPress={() => send({type:'tap', key:'enter'})}>
            <View style={theme.switchBar}><Text style={theme.btnText}>Enter</Text></View>
          </TouchableOpacity>
        </View>

        <AppLauncherModal 
          visible={isLauncherVisible} 
          onClose={() => setLauncherVisible(false)} 
          onOpenApp={(url) => send({ type: 'open_url', value: url })}
        />

        <MediaModal 
          visible={isMediaModalVisible} 
          onClose={() => setMediaModalVisible(false)} 
          send={send} 
        />

        <SystemModal 
          visible={isSystemModalVisible} 
          onClose={() => setSystemModalVisible(false)} 
          send={send} 
        />

        <SensitivityModal 
          visible={isSensModalVisible} 
          onClose={() => setSensModalVisible(false)}
          sensitivity={sensitivity} setSensitivity={setSensitivity}
          scrollSensitivity={scrollSensitivity} setScrollSensitivity={setScrollSensitivity}
          smoothFactor={smoothFactor} setSmoothFactor={setSmoothFactor}
        />
      </View>
    </GestureHandlerRootView>
  );
};
