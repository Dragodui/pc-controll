package protocol

type Command struct {
	Type   string  `json:"type"`
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Key    string  `json:"key"`
	Value  string  `json:"value"`
	Token  string  `json:"token"`
	Button string  `json:"button"`
}

// Reply types the server sends back over the same socket. Clients wait for
// AuthOK before showing the trackpad, so a wrong password is visible at once
// instead of silently dropping every command.
const (
	TypeAuth      = "auth"
	TypeAuthOK    = "auth_ok"
	TypeAuthError = "auth_error"
)

type Reply struct {
	Type    string `json:"type"`
	Message string `json:"message,omitempty"`
}
