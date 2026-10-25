# Prebuilt Chrome extension

[Download ZIP](https://github.com/colonfranxio/Friction/raw/refs/heads/main/releases/friction-extension.zip) · [SHA-256](friction-extension.zip.sha256)

Extract the ZIP and load `friction/extension` at `chrome://extensions` → Developer mode → Load unpacked. The package includes installation/walkthrough docs and the sample syllabus. It does not include a backend or credentials. See the repository README for local API setup; the sandbox is optional.

`friction/SOURCE-COMMIT.txt` records the source revision used for the build. This is a localhost extension, not a deployed public service. The archive is committed here for anonymous downloading without Actions/release-publishing access.

Maintainers: build with `pnpm build:ext`, then run `python scripts/package-extension.py` (or `python3` on macOS/Linux). It uses only Python's standard library and a whitelist of built assets/docs/fixtures. Commit the ZIP and checksum together. The manual Package judge extension workflow runs tests and produces the same package layout. Rebuild/reload and verify in Chrome after runtime changes.
