package discovery

import (
	"log"

	"github.com/grandcat/zeroconf"
)

func StartMDNS(pcName string, port int) {
	server, err := zeroconf.Register(
		pcName,
		"_remotepad._tcp",
		"local.",
		port,
		[]string{"txtv=1", "app=go-remote"},
		nil,
	)
	if err != nil {
		log.Fatalf("mDNS Error: %v", err)
	}
	defer server.Shutdown()

	log.Printf("mDNS: Service registered as '%s'", pcName)
	select {}
}
