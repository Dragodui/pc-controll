//go:build !webui

package webui

import "embed"

// No client bundled: Handler falls back to the placeholder page.
var assets embed.FS
