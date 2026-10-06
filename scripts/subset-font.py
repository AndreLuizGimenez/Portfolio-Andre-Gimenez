"""Cuts Manrope down to the Latin characters a Portuguese page can use, the range Google Fonts serves as
"latin": every glyph keeps its weight variation, features, kerning and hints, so text renders exactly as
with the full family. The full family comes from the copy the demo ships.

    pip install fonttools brotli
    python3 scripts/subset-font.py
"""
from pathlib import Path
from fontTools import subset

root = Path(__file__).resolve().parents[1]
source = root / 'dist/demos/nival/fonts/manrope-variable.woff2'
target = root / 'dist/portfolio/fonts/manrope-latin.woff2'
LATIN = ('U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,'
         'U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD')

options = subset.Options()
options.layout_features = ['*']
options.name_IDs = ['*']
options.name_languages = ['*']
options.hinting = True
options.notdef_outline = True
options.flavor = 'woff2'
font = subset.load_font(str(source), options)
subsetter = subset.Subsetter(options)
subsetter.populate(unicodes=subset.parse_unicodes(LATIN))
subsetter.subset(font)
subset.save_font(font, str(target), options)
print(f'{target.relative_to(root)}: {target.stat().st_size / 1024:.1f} kB (from {source.stat().st_size / 1024:.1f} kB)')
