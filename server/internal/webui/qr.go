package webui

import (
	"fmt"
	"net/http"
	"strconv"

	qrcode "github.com/skip2/go-qrcode"
)

// QRHandler renders a PNG QR code with the URL of this server, so a phone can
// scan it and land on the browser client. `?size=` sets the pixel size.
func QRHandler(url func(r *http.Request) string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		size := 256
		if v, err := strconv.Atoi(r.URL.Query().Get("size")); err == nil && v >= 64 && v <= 1024 {
			size = v
		}
		png, err := qrcode.Encode(url(r), qrcode.Medium, size)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "image/png")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Content-Length", fmt.Sprint(len(png)))
		w.Write(png)
	})
}

// QRPNG is the same image for in-process use (the desktop window).
func QRPNG(url string, size int) ([]byte, error) {
	return qrcode.Encode(url, qrcode.Medium, size)
}
