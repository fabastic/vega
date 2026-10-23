#!/bin/bash
# Builds the White Room from its parts.
#   viz/whiteroom.html   the page (no document wrapper; also what the claude.ai artifact publishes)
#   site/index.html      the same page as a full document, served by Vercel
#   --test               also writes test/t.html with a window.__v debug hook for the Playwright scripts
set -e
here="$(cd "$(dirname "$0")" && pwd)"; repo="$(cd "$here/../.." && pwd)"; src="$here/src"
parts="$src/a_head.html $src/b_core.js $src/c_world.js $src/d_chamber.js $(ls $src/d2_*.js) $src/e_after.js $(ls $src/e2_*.js) $src/f_ui.js"
cat $parts > "$repo/viz/whiteroom.html"
python3 - "$repo" "$1" <<'PY'
import sys
repo, mode = sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else ''
page = open(f'{repo}/viz/whiteroom.html').read()
head = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="A psychological life simulation. Vega lives, loves and works among villages, is sealed in a white chamber while the world outside dies, then survives what is left. Every choice comes from his own needs and feelings; you can watch, or play God.">
'''
i = page.index('</style>') + len('</style>')
open(f'{repo}/site/index.html', 'w').write(head + page[:i] + '\n</head>\n<body>' + page[i:] + '\n</body>\n</html>\n')
if mode == '--test':
    end = 'requestAnimationFrame(frame);\n})();'
    hook = "window.__v = { EVENTS, S, A, sim, ROOM, cfg: () => cfg, citizens, COMPANIONS, ANIMALS, setView, VILL, camera, controls, setSpeed, HOUSES, BUILDS, scene, roomScene, vegaC: () => vegaC, makeHuman, pose, applyPose, setFace, holdTool, lookAtPoint, setMass, THREE };\n"
    j = page.rindex(end)
    open(f'{repo}/viz/whiteroom/test/t.html', 'w').write(page[:j] + hook + page[j:])
PY
echo "built viz/whiteroom.html and site/index.html${1:+ (+ test/t.html)}"
