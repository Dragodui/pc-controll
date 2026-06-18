package server

import "net"

type noDelayListener struct {
	*net.TCPListener
}

func (l noDelayListener) Accept() (net.Conn, error) {
	conn, err := l.TCPListener.AcceptTCP()
	if err != nil {
		return nil, err
	}
	if err := conn.SetNoDelay(true); err != nil {
		conn.Close()
		return nil, err
	}
	return conn, nil
}
