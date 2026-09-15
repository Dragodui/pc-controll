package discovery

import (
	"fmt"

	"github.com/grandcat/zeroconf"
)

const ServiceType = "_remotepad._tcp"

// Advertiser announces the server over mDNS until Shutdown is called.
type Advertiser struct {
	server *zeroconf.Server
}

func StartMDNS(pcName string, port int) (*Advertiser, error) {
	server, err := zeroconf.Register(
		pcName,
		ServiceType,
		"local.",
		port,
		[]string{"txtv=1", "app=go-remote"},
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("mDNS register: %w", err)
	}
	return &Advertiser{server: server}, nil
}

func (a *Advertiser) Shutdown() {
	if a != nil && a.server != nil {
		a.server.Shutdown()
	}
}
