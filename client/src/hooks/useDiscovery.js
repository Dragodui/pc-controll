import { useState, useRef } from 'react';
import { Alert } from 'react-native';
import * as Network from 'expo-network';
import * as Haptics from 'expo-haptics';
import Zeroconf from 'react-native-zeroconf';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SERVER_PORT, MDNS_TYPE, MDNS_PROTOCOL, MDNS_DOMAIN } from '../constants/config';

export const useDiscovery = (setDevices) => {
  const [isScanning, setIsScanning] = useState(false);
  const zeroconfRef = useRef(null);

  const mdnsDiscover = () => {
    return new Promise((resolve) => {
      if (!zeroconfRef.current) zeroconfRef.current = new Zeroconf();
      const zeroconf = zeroconfRef.current;
      const found = new Map();

      const onResolved = (service) => {
        const ip = service.addresses?.find(a => a.indexOf(':') === -1) || service.host;
        if (!ip) return;
        const id = `${ip}:${service.port}`;
        if (!found.has(id)) {
          found.set(id, { id, name: service.name, ip, port: service.port, pass: "", online: true });
        }
      };

      zeroconf.on("resolved", onResolved);
      zeroconf.scan(MDNS_TYPE, MDNS_PROTOCOL, MDNS_DOMAIN);
      setTimeout(() => {
        zeroconf.stop();
        zeroconf.removeListener("resolved", onResolved);
        resolve(Array.from(found.values()));
      }, 2000);
    });
  };

  const smartScan = async () => {
    setIsScanning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const mdnsDevices = await mdnsDiscover();
      const ipAddr = await Network.getIpAddressAsync();
      const subnet = ipAddr.substring(0, ipAddr.lastIndexOf('.'));
      const scanPromises = [];

      for (let i = 1; i < 255; i++) {
        const testIp = `${subnet}.${i}`;
        scanPromises.push(
          fetch(`http://${testIp}:${SERVER_PORT}/health`)
            .then(res => res.ok ? testIp : null).catch(() => null)
        );
      }
      const foundIps = (await Promise.all(scanPromises)).filter(ip => ip !== null);
      const subnetDevices = foundIps.map(ip => ({
        id: `${ip}:${SERVER_PORT}`, name: 'Subnet PC', ip, port: SERVER_PORT, pass: "", online: true
      }));

      setDevices(prev => {
        const combined = [...prev, ...mdnsDevices, ...subnetDevices];
        const unique = combined.reduce((acc, current) => {
          const exists = acc.find(item => item.ip === current.ip && item.port === current.port);
          if (!exists) return acc.concat([current]);
          return acc;
        }, []);
        AsyncStorage.setItem('devices', JSON.stringify(unique));
        return unique;
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert("Error", "Check network connection");
    } finally {
      setIsScanning(false);
    }
  };

  return { isScanning, smartScan };
};
