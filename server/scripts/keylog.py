#!/usr/bin/env python3
# Read raw key events from the 'pcinput virtual input' device. Proves what the
# server injects, independent of which window is focused. Needs 'input' group.
# Usage: python3 scripts/keylog.py [seconds]
import struct, sys, time, re, os

dev = None
with open("/proc/bus/input/devices") as f:
    block = ""
    for line in f:
        block = "" if line.strip() == "" else block + line
        if "pcinput virtual input" in block and (m := re.search(r"event\d+", block)):
            dev = "/dev/input/" + m.group(); break
if not dev:
    sys.exit("pcinput virtual input device not found")

NAMES = {1:"ESC",2:"1",3:"2",4:"3",5:"4",6:"5",7:"6",8:"7",9:"8",10:"9",11:"0",12:"-",13:"=",14:"BACKSPACE",15:"TAB",
 16:"q",17:"w",18:"e",19:"r",20:"t",21:"y",22:"u",23:"i",24:"o",25:"p",26:"[",27:"]",28:"ENTER",29:"LCTRL",
 30:"a",31:"s",32:"d",33:"f",34:"g",35:"h",36:"j",37:"k",38:"l",39:";",40:"'",42:"LSHIFT",44:"z",45:"x",46:"c",
 47:"v",48:"b",49:"n",50:"m",51:",",52:".",53:"/",56:"LALT",57:"SPACE",125:"LMETA",272:"BTN_LEFT",273:"BTN_RIGHT",274:"BTN_MIDDLE"}
FMT = "llHHi"; SZ = struct.calcsize(FMT)
secs = float(sys.argv[1]) if len(sys.argv) > 1 else 15
fd = os.open(dev, os.O_RDONLY | os.O_NONBLOCK)
print(f"listening on {dev} for {secs}s", flush=True)
end = time.time() + secs; typed = []; moves = 0; scrolls = 0
while time.time() < end:
    try: data = os.read(fd, SZ * 64)
    except BlockingIOError: time.sleep(0.01); continue
    for i in range(0, len(data), SZ):
        _, _, etype, code, val = struct.unpack(FMT, data[i:i+SZ])
        if etype == 1 and val == 1:
            n = NAMES.get(code, f"KEY_{code}"); typed.append(n); print(f"  key {n}", flush=True)
        elif etype == 2 and code in (0, 1): moves += 1
        elif etype == 2 and code in (8, 11): scrolls += 1
print(f"summary: {len(typed)} key presses, {moves} move events, {scrolls} scroll events")
print("keys:", " ".join(typed))
