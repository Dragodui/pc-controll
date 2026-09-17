// Web: browsers cannot do mDNS. The page is served by the server itself, so
// the host of the current URL is the PC to control.

export const canDiscover = false;

export function mdnsDiscover() {
  return Promise.resolve([]);
}

export function hostDevice() {
  if (typeof window === 'undefined' || !window.location?.hostname) return null;
  const { hostname, port, protocol } = window.location;
  const p = parseInt(port || (protocol === 'https:' ? '443' : '80'), 10);
  return { id: `${hostname}:${p}`, name: 'This PC', ip: hostname, port: p, pass: '', online: true };
}
