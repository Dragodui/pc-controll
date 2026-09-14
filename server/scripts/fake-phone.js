#!/usr/bin/env node
// Simulates the mobile client over WebSocket. No dependencies (Node >= 22).
//
//   node scripts/fake-phone.js                 # run every scenario
//   node scripts/fake-phone.js move click      # only these
//   HOST=192.168.0.10 node scripts/fake-phone.js
//
// Scenarios: auth move scroll click type unicode langswitch keys alttab spotlight flood
// Watch your screen: the cursor should draw a square, scroll, type text, etc.

const fs = require("fs");
const path = require("path");

function loadEnv() {
  const p = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const env = { ...loadEnv(), ...process.env };
const HOST = env.HOST || "127.0.0.1";
const PORT = env.WS_PORT || "1212";
const TOKEN = env.SERVER_PASSWORD || "1234";
const URL = `ws://${HOST}:${PORT}/ws`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const t = setTimeout(() => reject(new Error(`connect timeout ${url}`)), 4000);
    ws.onopen = () => { clearTimeout(t); resolve(ws); };
    ws.onerror = () => { clearTimeout(t); reject(new Error(`connect failed ${url}`)); };
  });
}

let ws;
let sent = 0;
// Same shape as client/app/useRemoteControl.js send(): payload + token.
function send(cmd, token = TOKEN) {
  ws.send(JSON.stringify({ ...cmd, token }));
  sent++;
}

// Mirror phone behaviour: move sends many small relative deltas at ~60 Hz.
async function drag(dx, dy, steps = 30, delayMs = 16) {
  for (let i = 0; i < steps; i++) {
    send({ type: "move", x: dx, y: dy });
    await sleep(delayMs);
  }
}

const scenarios = {
  async auth() {
    // Server logs "Access Denied" and ignores it; nothing visible should happen.
    send({ type: "click", button: "left" }, "wrong-password");
    await sleep(100);
    console.log("   sent click with bad token; expect 'Access Denied' in docker logs, no click on screen");
  },
  async move() {
    console.log("   cursor should trace a square");
    await drag(5, 0); await drag(0, 5); await drag(-5, 0); await drag(0, -5);
  },
  async scroll() {
    console.log("   focused window should scroll down, then up");
    for (let i = 0; i < 10; i++) { send({ type: "scroll", x: 0, y: -1 }); await sleep(40); }
    await sleep(300);
    for (let i = 0; i < 10; i++) { send({ type: "scroll", x: 0, y: 1 }); await sleep(40); }
  },
  async click() {
    console.log("   left click, then right click (context menu should open)");
    send({ type: "click", button: "left" });
    await sleep(500);
    send({ type: "click", button: "right" });
    await sleep(500);
    send({ type: "tap", key: "escape_not_supported_ignore" }); // exercises unsupported-key error path
  },
  async type() {
    console.log("   focus a text field first! typing ASCII");
    send({ type: "type_string", value: "hello from fake phone 123 " });
    await sleep(300);
  },
  async unicode() {
    console.log("   typing Cyrillic via wl-copy + Ctrl+V (clipboard will be overwritten)");
    send({ type: "type_string", value: "привет " });
    await sleep(300);
  },
  async langswitch() {
    // Phone user types Latin, switches keyboard language, types Cyrillic, switches back.
    console.log("   latin, then cyrillic (clipboard paste), then latin again");
    send({ type: "type_string", value: "latin text " });
    await sleep(400);
    send({ type: "type_string", value: "русский текст " });
    await sleep(400);
    send({ type: "type_string", value: "back to latin" });
    await sleep(300);
  },
  async keys() {
    console.log("   space, backspace, enter");
    send({ type: "tap", key: "space" }); await sleep(100);
    send({ type: "tap", key: "backspace" }); await sleep(100);
    send({ type: "tap", key: "enter" }); await sleep(100);
  },
  async alttab() {
    console.log("   alt held, tab x2, alt released: window switcher should appear and switch");
    send({ type: "key_down", key: "alt" });
    await sleep(150);
    send({ type: "tap", key: "tab" });
    await sleep(400);
    send({ type: "tap", key: "tab" });
    await sleep(400);
    send({ type: "key_up", key: "alt" });
  },
  async spotlight() {
    console.log("   command(super)+space, like the client's launcher shortcut");
    send({ type: "key_down", key: "command" });
    send({ type: "tap", key: "space" });
    send({ type: "key_up", key: "command" });
    await sleep(300);
  },
  async flood() {
    // Burst like a fast swipe; checks the server keeps up and does not drop the socket.
    const t0 = Date.now();
    for (let i = 0; i < 600; i++) send({ type: "move", x: i % 2 ? 2 : -2, y: 0 });
    await sleep(200);
    if (ws.readyState !== WebSocket.OPEN) throw new Error("socket closed during flood");
    console.log(`   600 moves in ${Date.now() - t0} ms, socket still open`);
  },
};

async function main() {
  const wanted = process.argv.slice(2);
  const names = wanted.length ? wanted : Object.keys(scenarios);
  for (const n of names) if (!scenarios[n]) { console.error(`unknown scenario '${n}'. have: ${Object.keys(scenarios).join(" ")}`); process.exit(2); }

  const health = await fetch(`http://${HOST}:${PORT}/health`).then((r) => r.text()).catch((e) => e.message);
  console.log(`health http://${HOST}:${PORT}/health -> ${health}`);
  if (health !== "OK") process.exit(1);

  ws = await connect(URL);
  console.log(`connected ${URL} (token from .env)`);
  ws.onclose = (e) => console.log(`socket closed code=${e.code}`);

  console.log("starting in 3s: switch to a window with a text field (e.g. a text editor)...");
  await sleep(3000);

  let failed = 0;
  for (const n of names) {
    console.log(`>> ${n}`);
    try { await scenarios[n](); }
    catch (e) { failed++; console.log(`   FAIL ${e.message}`); }
    await sleep(700);
  }
  ws.close();
  console.log(`done: ${sent} commands sent, ${failed} scenario errors`);
  console.log("now check: docker logs --since 2m pc-control-server | grep -i 'failed\\|denied'");
  console.log("expected there: one 'Access Denied' (auth) and one 'unsupported key' (click). Anything else = real problem.");
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
