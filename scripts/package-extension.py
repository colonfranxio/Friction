"""Package the built extension without dependencies: python scripts/package-extension.py."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import hashlib
import subprocess

root = Path(__file__).resolve().parent.parent
source = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
dist = root / 'apps/extension/dist'
assets = ['manifest.json', 'content.js', 'background.js', 'popup.html', 'popup.js', 'sidepanel.html', 'sidepanel.js'] + ['icons/icon-' + str(size) + '.png' for size in [16, 32, 48, 128]]
for name in assets:
    if not (dist / name).is_file():
        raise SystemExit('Build first: pnpm build:ext (missing ' + name + ')')
actual = {p.relative_to(dist).as_posix() for p in dist.rglob('*') if p.is_file()}
if actual != set(assets) or any(p.is_symlink() for p in dist.rglob('*')):
    raise SystemExit('Unexpected extension build files or symlinks; rebuild a clean dist before packaging')
files = {'friction/extension/' + name: (dist / name).read_bytes() for name in assets}
for name in ['README.md', 'docs/JUDGE-GUIDE.md', 'docs/DEMO-VIDEO.md', 'docs/SUBMISSION-SETUP.md', 'docs/PUBLIC-API-HANDOFF.md', 'fixtures/elementary-syllabus.md', 'fixtures/elementary-syllabus.pdf']:
    files['friction/' + name] = (root / name).read_bytes()
files['friction/SOURCE-COMMIT.txt'] = (source + '\n').encode()
out = root / 'releases/friction-extension.zip'
out.parent.mkdir(exist_ok=True)
with ZipFile(out, 'w', ZIP_DEFLATED) as archive:
    for name, data in sorted(files.items()):
        info = ZipInfo(name, (2026, 1, 1, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        archive.writestr(info, data)
with ZipFile(out) as archive:
    assert archive.testzip() is None
checksum = hashlib.sha256(out.read_bytes()).hexdigest()
out.with_suffix('.zip.sha256').write_text(checksum + '  friction-extension.zip\n', encoding='utf-8')
print('Packaged', out.relative_to(root), 'from', source)
