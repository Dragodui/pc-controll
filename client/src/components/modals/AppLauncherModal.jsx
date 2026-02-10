import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { theme } from '../../styles/theme';

const APPS = [
  { 
    name: 'YouTube', 
    url: 'https://youtube.com', 
    image: { uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/YouTube_full-color_icon_%282017%29.svg/1280px-YouTube_full-color_icon_%282017%29.svg.png' }
  },
  { 
    name: 'Spotify', 
    url: 'spotify:', 
    image: { uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Spotify_logo_without_text.svg/1024px-Spotify_logo_without_text.svg.png' }
  },
  { 
    name: 'Discord', 
    url: 'discord://', 
    image: { uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Discord_Logo_sans_text.svg/1200px-Discord_Logo_sans_text.svg.png' }
  },
  { 
    name: 'Steam', 
    url: 'steam://', 
    image: { uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Steam_icon_logo.svg/2048px-Steam_icon_logo.svg.png' }
  },
  { 
    name: 'Telegram', 
    url: 'tg://', 
    image: { uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Telegram_logo.svg/2048px-Telegram_logo.svg.png' }
  },
];

export const AppLauncherModal = ({ visible, onClose, onOpenApp }) => {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={theme.modalFull}>
        <View style={theme.modalBox}>
          <Text style={[theme.modalLabel, {textAlign:'center', fontSize: 16, marginBottom: 20}]}>QUICK LAUNCHER</Text>
          <View style={styles.grid}>
            {APPS.map((app) => (
              <TouchableOpacity 
                key={app.name} 
                style={styles.appBtn} 
                onPress={() => {
                  onOpenApp(app.url);
                  onClose();
                }}
              >
                <Image 
                  source={app.image} 
                  style={styles.appIcon}
                  resizeMode="contain"
                />
                <Text style={styles.appText}>{app.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity 
            style={[theme.mBtn, {backgroundColor: '#333', width: '100%', marginTop: 20}]} 
            onPress={onClose}
          >
            <Text style={{color:'#fff'}}>CLOSE</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  appBtn: { 
    width: '30%', 
    aspectRatio: 1, 
    backgroundColor: '#1a1a1a', 
    padding: 10, 
    borderRadius: 20, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 15 
  },
  appIcon: {
    width: 40,
    height: 40,
    marginBottom: 5,
  },
  appText: { color: '#fff', marginTop: 5, fontSize: 10, fontWeight: 'bold' }
});