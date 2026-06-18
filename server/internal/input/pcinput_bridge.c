//go:build cgo && pcinput

#include "../../native/pcinput/src/error.c"
#include "../../native/pcinput/src/backend_null.c"
#include "../../native/pcinput/src/backend_detect.c"
#include "../../native/pcinput/src/pcinput.c"
#include "../../native/pcinput/src/platform_windows.c"
#include "../../native/pcinput/src/platform_linux_uinput.c"
