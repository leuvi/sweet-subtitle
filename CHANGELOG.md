# Changelog

All notable changes to this project will be documented in this file.

## [0.1.4] - 2026-04-24

### Added

- Single-package multi-entry exports for framework adapters:
  - sweet-subtitle/react
  - sweet-subtitle/vue
  - sweet-subtitle/angular
- New subtitle format support:
  - SBV
  - TTML/DFXP
- Additional parser exports:
  - parseSBV
  - parseTTML
- Promise-based loading APIs:
  - loadFromUrl(url, format?)
  - loadFromText(content, format?)
- Event ergonomics:
  - on(...) now returns unsubscribe
  - once(...) added
- Encoding robustness improvements:
  - force encoding option (encoding)
  - configurable fallback chain (fallbackEncodings)
  - UTF-16 no-BOM heuristic detection
  - fallback decode attempts for GBK/Big5/Shift-JIS
- Encoding regression subtitle fixtures under 素材/encoding-tests.

### Changed

- README updated for single-package usage and framework subpath imports.
- npm discoverability improvements in package description, keywords, and README top section.

### Notes

- The package sweet-subtitle-wasm is treated as internal build output and is not required for normal users.
- Primary package to install is sweet-subtitle.
