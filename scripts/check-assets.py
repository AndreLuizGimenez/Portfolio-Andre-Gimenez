"""Check portable local HTML/CSS asset references; no browser required."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import re

root = Path(__file__).resolve().parents[1] / 'dist'
missing = []
checked = 0

def check(value, source):
    global checked
    url = urlsplit(value)
    if url.scheme or url.netloc or not url.path or value.startswith('#'):
        return
    path = root / unquote(url.path.lstrip('/')) if url.path.startswith('/') else source.parent / unquote(url.path)
    checked += 1
    if not path.exists():
        missing.append(f'{source.relative_to(root)}: {value}')

class Assets(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.source = source
        self.ids = set()
        self.anchors = []

    def handle_starttag(self, tag, attrs):
        data = dict(attrs)
        if 'id' in data:
            if data['id'] in self.ids:
                missing.append(f'{self.source.relative_to(root)}: duplicate id {data["id"]}')
            self.ids.add(data['id'])
        for name in ('src', 'href', 'poster', 'data-src'):
            value = data.get(name)
            if not value:
                continue
            if value.startswith('#'):
                self.anchors.append(value[1:])
            else:
                check(value, self.source)
        for candidate in (data.get('srcset') or '').split(','):
            if candidate.strip():
                check(candidate.split()[0], self.source)

for source in root.rglob('*.html'):
    parser = Assets(source)
    parser.feed(source.read_text())
    for anchor in parser.anchors:
        if anchor and anchor not in parser.ids:
            missing.append(f'{source.relative_to(root)}: missing anchor #{anchor}')

for source in root.rglob('*.css'):
    for match in re.finditer(r'url\([\s\"\']*([^\)\"\']+)', source.read_text()):
        check(match.group(1).strip(), source)

if missing:
    raise SystemExit('\n'.join(missing))
print(f'OK: {checked} asset references, all HTML anchors and ids verified.')
