#!/usr/bin/env bash
# Builds plugin/main.js (render.js and setup.js inlined before plugin.js) and copies it into the demo vault.
set -euo pipefail
cd "$(dirname "$0")"
{ echo "/* Mind Organization — built file. Edit render.js / setup.js / showcase.js / plugin.js instead. */"; cat render.js; echo; cat setup.js; echo; cat showcase.js; echo; cat plugin.js; } > main.js
dest=../demo-vault/.obsidian/plugins/mind-organization
mkdir -p "$dest"
cp main.js manifest.json styles.css "$dest/"
mkdir -p "$dest/assets" && cp assets/* "$dest/assets/"
echo "built main.js → $dest"
