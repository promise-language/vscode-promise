# Changelog

All notable changes to the Promise Language extension are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0]

### Added
- Syntax highlighting (TextMate grammar) for `.pr` files: keywords, types,
  operators, string interpolation, backtick annotations, and comments.
- Snippets for common patterns (type declarations, error handling, tests,
  generators, match blocks).
- Bracket matching, auto-closing pairs, comment toggling, and code folding.
- File icons for `.pr` files (light/dark).
- Compiler integration: configurable `promise.compilerPath`, format-on-save via
  `promise format`, and build/run/check/test tasks with a problem matcher.
- Grammar test suite (12 files) and unit tests.
