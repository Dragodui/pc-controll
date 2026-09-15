package desktop

func platformHint() string {
	return "No access to /dev/uinput. Run make install-uinput, re-login, restart."
}
