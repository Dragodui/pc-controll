package main

type Command struct {
	Type   string  `json:"type"`
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Key    string  `json:"key"`
	Value  string  `json:"value"`
	Token  string  `json:"token"`
	Button string  `json:"button"`
}
