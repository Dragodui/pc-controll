package input

import "errors"

func errBackendRemoved(message string) error {
	return errors.New(message)
}
