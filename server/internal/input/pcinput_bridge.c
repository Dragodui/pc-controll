//go:build cgo && pcinput

#include "error.c"
#include "backend_null.c"
#include "backend_detect.c"
#include "pcinput.c"
#include "platform_windows.c"
#include "platform_linux_uinput.c"
