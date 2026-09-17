//go:build webui

package webui

import "embed"

// Populated by `make web` (copies client/dist here). Gitignored.
//
//go:embed all:dist
var assets embed.FS
