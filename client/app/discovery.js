// Native: mDNS via react-native-zeroconf. The web build uses discovery.web.js.
import Zeroconf from 'react-native-zeroconf';

const MDNS_TYPE = 'remotepad';
const MDNS_PROTOCOL = 'tcp';
const MDNS_DOMAIN = 'local.';

let zeroconf = null;

export const canDiscover = true;

// Resolves with devices seen within `timeoutMs`.
export function mdnsDiscover(timeoutMs = 2000) {
  return new Promise((resolve) => {
    if (!zeroconf) zeroconf = new Zeroconf();
    const found = new Map();

    const onResolved = (service) => {
      const ip = service.addresses?.find((address) => address.indexOf(':') === -1) || service.host;
      if (!ip) return;
      const id = `${ip}:${service.port}`;
      if (!found.has(id)) {
        found.set(id, { id, name: service.name, ip, port: service.port, pass: '', online: true });
      }
    };

    zeroconf.on('resolved', onResolved);
    zeroconf.scan(MDNS_TYPE, MDNS_PROTOCOL, MDNS_DOMAIN);
    setTimeout(() => {
      zeroconf.stop();
      zeroconf.removeListener('resolved', onResolved);
      resolve(Array.from(found.values()));
    }, timeoutMs);
  });
}

// The device serving this page, if any. Native builds are not served by a server.
export function hostDevice() {
  return null;
}
