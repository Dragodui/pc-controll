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

// The QR code the server shows carries the password as ?pass=, so scanning it
// connects without typing. The value is removed from the address bar right
// away so it does not linger in history or in a shared link.
export function passwordFromURL() {
  if (typeof window === 'undefined' || !window.location?.search) return '';
  const params = new URLSearchParams(window.location.search);
  const pass = params.get('pass') || '';
  if (pass) {
    params.delete('pass');
    const query = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (query ? `?${query}` : ''));
  }
  return pass;
}
