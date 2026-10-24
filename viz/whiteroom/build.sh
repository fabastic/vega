#!/bin/bash
# Builds the White Room from its parts.
#   viz/whiteroom.html   the page (no document wrapper; also what the claude.ai artifact publishes)
#   site/index.html      the same page as a full document, served by Vercel
#   viz/evidence.html    the evidence view, evidence/page.html with evidence/evidence.json inlined
#   site/evidence.html   the same as a full document
#   --test               also writes test/t.html with a window.__v debug hook for the Playwright scripts
set -e
here="$(cd "$(dirname "$0")" && pwd)"; repo="$(cd "$here/../.." && pwd)"; src="$here/src"
# an array, so a checkout path with spaces in it still builds
parts=("$src/a_head.html" "$src/b_core.js" "$src/c_world.js" "$src/d_chamber.js" "$src"/d2_*.js "$src/e_after.js" "$src"/e2_*.js "$src/f_ui.js")
cat "${parts[@]}" > "$repo/viz/whiteroom.html"
python3 - "$repo" "$1" <<'PY'
import sys
# utf-8 and LF whatever the platform's defaults (Windows would read cp1252 and write CRLF)
rd = lambda f: open(f, encoding='utf-8').read()
wr = lambda f, s: open(f, 'w', encoding='utf-8', newline='').write(s)
repo, mode = sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else ''
page = rd(f'{repo}/viz/whiteroom.html')
head = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="A psychological life simulation. Vega lives, loves and works among villages, is sealed in a white chamber while the world outside dies, then survives what is left. Every choice comes from his own needs and feelings; you can watch, or play God.">
'''
def wrap(page, head):
    i = page.index('</style>') + len('</style>')
    return head + page[:i] + '\n</head>\n<body>' + page[i:] + '\n</body>\n</html>\n'
wr(f'{repo}/site/index.html', wrap(page, head))
# the evidence view: its data is measured, so it is embedded from the committed evidence.json, never typed in
ev = rd(f'{repo}/viz/whiteroom/evidence/page.html')
data = rd(f'{repo}/viz/whiteroom/evidence/evidence.json').strip()
assert '/*EVIDENCE_JSON*/null' in ev
ev = ev.replace('/*EVIDENCE_JSON*/null', data)
wr(f'{repo}/viz/evidence.html', ev)
wr(f'{repo}/site/evidence.html', wrap(ev, head.replace(head[head.index('<meta name="description"'):], '<meta name="description" content="What the white room measurably did to vega\'s two artificial minds, beside what sensory deprivation does to people. Every number is labelled measured, from human studies, or illustration.">\n')))
if mode == '--test':
    end = 'requestAnimationFrame(frame);\n})();'
    hook = "window.__v = { EVENTS, S, A, sim, ROOM, cfg: () => cfg, citizens, COMPANIONS, ANIMALS, setView, VILL, camera, controls, setSpeed, HOUSES, BUILDS, scene, roomScene, vegaC: () => vegaC, makeHuman, pose, applyPose, setFace, holdTool, lookAtPoint, setMass, THREE, renderer };\n"
    j = page.rindex(end)
    wr(f'{repo}/viz/whiteroom/test/t.html', page[:j] + hook + page[j:])
PY
echo "built viz/whiteroom.html, viz/evidence.html and their site/ copies${1:+ (+ test/t.html)}"
