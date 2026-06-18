package input

import "log"

func NewBackend() Backend {
	backend, err := NewCBackend()
	if err != nil {
		log.Printf("pcinput backend is unavailable: %v", err)
		return UnavailableBackend{BackendName: "pcinput", Err: err}
	}
	log.Printf("Input backend selected: %s", backend.Name())
	return backend
}
