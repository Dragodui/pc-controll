// Package webui serves the browser client (the Expo web export) from the
// server binary, so a phone can open http://<pc>:<port>/ and control the PC
// without installing anything. Build with -tags webui after `make web`;
// without the tag a short placeholder page is served instead.
package webui

import (
	"io/fs"
	"net/http"
	"strings"
)

// Handler serves the embedded client at the root path.
func Handler() http.Handler {
	sub, err := fs.Sub(assets, "dist")
	if err != nil || !hasIndex(sub) {
		return http.HandlerFunc(placeholder)
	}
	files := http.FileServer(http.FS(sub))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// The app shell and the service worker must always be revalidated;
		// hashed bundles under /_expo can be cached forever.
		switch {
		case r.URL.Path == "/" || r.URL.Path == "/index.html" || r.URL.Path == "/sw.js" || r.URL.Path == "/manifest.json":
			w.Header().Set("Cache-Control", "no-cache")
		case strings.HasPrefix(r.URL.Path, "/_expo/"):
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		}
		if r.URL.Path == "/sw.js" {
			w.Header().Set("Service-Worker-Allowed", "/")
		}
		files.ServeHTTP(w, r)
	})
}

func hasIndex(f fs.FS) bool {
	_, err := fs.Stat(f, "index.html")
	return err == nil
}

func placeholder(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write([]byte(`<!doctype html><title>PC Control</title><body style="font-family:system-ui;margin:2em">
<h2>PC Control server is running</h2>
<p>This build has no web client. Use the mobile app, or rebuild the server with <code>make web</code> then <code>make</code>.</p>`))
}
