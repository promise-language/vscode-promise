# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

VS Code extension for the **Promise programming language** — a statically-typed, natively-compiled language. Source files use the `.pr` extension.

The compiler lives in a separate repository: https://github.com/promise-language/promise. For language details, see `docs/language-design.md` (full spec) and `docs/language-guide-for-agents.md` (concise syntax reference) there — or a local checkout at `../promise/` if available.

## Build, Test & Run

```bash
npm install              # install dependencies
npm run compile          # compile TypeScript
npm run watch            # watch mode for development
npm test                 # run grammar tests (12 suites)
```

To test the extension visually: press F5 in VS Code to launch an Extension Development Host.

To package: `npx vsce package`

## Tests

```bash
npm test              # runs all tests (grammar + unit)
npm run test:grammar  # grammar tests only
npm run test:unit     # unit tests only
```

### Grammar Tests

Grammar tests use `vscode-tmgrammar-test` with annotated `.pr.test` files in `tests/grammar/`. Each file asserts that specific Promise code tokens receive the correct TextMate scopes.

```bash
npx vscode-tmgrammar-test -g syntaxes/promise.tmLanguage.json 'tests/grammar/specific.pr.test'  # run one
```

When modifying the TextMate grammar, always run `npm test` afterwards. To add coverage for new syntax, create a new `.pr.test` file or extend an existing one. Test assertion format:
```
// SYNTAX TEST "source.promise"
type Foo {
// <-- keyword.declaration.type.promise
//   ^^^ entity.name.type.promise
}
```

Key: `// <--` checks the first character of the previous line. `// ^^^` checks specific positions (aligned by column) on the previous line.

### Unit Tests

Unit tests in `tests/unit/*.test.js` use Node's built-in test runner. They test the pure logic in `src/utils.ts` (which has no `vscode` dependency): TOML epoch parsing, compiler binary resolution, task argument construction, problem matcher regex, and compiler reachability verification. Run `npm run compile` before `npm run test:unit` — the tests import compiled JS from `out/`.

## Key Promise Language Syntax (for grammar development)

### Keywords
`type`, `enum`, `is`, `as`, `if`, `else`, `for`, `while`, `match`, `return`, `raise`, `yield`, `break`, `continue`, `use`, `go`, `select`, `unsafe`, `move`, `none`, `true`, `false`, `this`, `super`, `get`, `set`, `new`, `in`

### Contextual Keywords (not reserved — valid as identifiers in other positions)
`present`, `absent`, `default`, `Self`

### Built-in Meta Annotations (backtick `` ` ``)
`public`, `abstract`, `native`, `value`, `instance`, `variant`, `type`, `raw`, `final`, `factory`, `test`, `copy`, `clone`, `inline`, `deprecated`, `serializable`, `structural`, `doc`, `target`, `embed`, `global`, `mono`, `extern`, `unsafe`, `packed`, `align`, `required`

### Primitive Types
`int`, `i8`, `i16`, `i32`, `i64`, `uint`, `u8`, `u16`, `u32`, `u64`, `f32`, `f64`, `bool`, `char`, `string`

### Operators (in precedence order, highest first)
1. Postfix: `.` `?.` `()` `[]` `[:]` `?` `!`
2. Unary prefix: `-` `!` `~` `<-`
3. Multiplicative: `*` `/` `%`
4. Shift: `<<` `>>`
5. Additive: `+` `-`
6. Bitwise: `&` `^` `|`
7. Range: `..` `..=`
8. Comparison: `<` `>` `<=` `>=` `is` `as`
9. Equality: `==` `!=`
10. Logical AND: `&&`
11. Logical OR: `||`
12. Elvis: `?:`

### String Syntax
- Regular: `"hello {name}"` — `{}` for interpolation, `\{` to escape
- Raw: `r"no \n escapes"`
- Triple-quoted: `"""multiline"""`
- Char: `'a'`, `'\n'`, `'\u{1F600}'`

### Type Syntax
- Named: `User`, `Box[int]`, `Map[string, int]`
- Vector sugar: `int[]` = `Vector[int]`
- Fixed array: `int[3]`
- Optional: `T?` = `Option[T]`
- Shared ref: `T&`, Mutable ref: `T~`
- Function: `(int, int) -> int`
- Tuple: `(int, string)`

### Declaration Patterns
```
type Name [typeParams] [is Parents] [annotations] { members }
enum Name [typeParams] [annotations] { Variant1(fields), Variant2, ... }
funcName[typeParams](params) ReturnType [annotations] { body }
get name Type [annotations] { body }
set name(Type param) [annotations] { body }
```

### Error Handling
- Failable return: `func() Type!`
- Auto-propagate: bare call in `!` function
- Panic unwrap: `expr!`
- Handle: `expr ? e { recovery }` or `expr ? e is ErrorType { recovery }`

### Comments
- Line: `// comment`
- Block: `/* comment */`

## Extension Architecture

### TextMate Grammar (`syntaxes/promise.tmLanguage.json`)
Defines syntax highlighting scopes. Key areas:
- Keywords, control flow, type declarations
- Backtick meta annotations (`` `public ``, `` `test ``, etc.)
- String interpolation within `"..."` strings
- Numeric literals with type suffixes (`42u8`, `3.14f32`)
- Function/method declarations (no `fn` keyword — identified by `name(` pattern)
- Generic type parameters in `[...]`
- Ownership markers (`&`, `~`) in parameter/type positions
- Operator methods (`+`, `==`, `[]`, `..`, `..=`, `[:]`, etc.)
- Expression body syntax (`=> expr;`)
- Lambda expressions with `move` support

### Grammar Design Decisions

**Function detection without `fn` keyword:** Top-level functions use `^\\s*` (start-of-line) with a negative lookahead excluding keywords (`if`, `for`, `while`, etc.). Methods inside type bodies use leading `\\s+` with similar exclusions.

**Constructor vs method priority:** `new(` is handled by a dedicated `constructor-declaration` rule with `\\s+` prefix so it matches at the same start position as `method-declaration`. The `method-declaration` pattern has a negative lookahead `(?!(?:get|set|new)\\b)` to avoid consuming these keywords.

**`as!` forced cast:** The `as!` pattern is placed in `#keywords` before the generic `as` modifier keyword to prevent `as` from being consumed first by the keyword rule.

**Lambda `|` vs bitwise OR `|`:** Lambda begin uses `|(?!\\|)` (negative lookahead rejects `||`) with a lookbehind `(?<=[=:,(\\s])` to only match `|` after assignment/separator contexts. `move ||` (empty-params lambda) is matched as a separate pattern. Standalone `|` as bitwise OR is handled by the operators rule.

**Built-in annotations with params:** Built-in annotation match (`` `test ``, `` `public ``, etc.) uses `(?!\\s*\\()` negative lookahead so that `` `test(expected: "...") `` routes to the parameterized annotation rule instead.

### Language Configuration (`language-configuration.json`)
- Bracket pairs, auto-closing, surrounding pairs
- Comment toggling (line and block)
- Folding markers
- Word pattern (identifiers including `_`)
- Indentation rules

### Snippets (`snippets/promise.json`)
Common code patterns with tab stops for rapid coding.

### Compiler Resolution (`src/compiler.ts`)
Resolves the `promise` **launcher stub**. Resolution order:
1. User-configured `promise.compilerPath` (if explicitly set in settings)
2. Launcher stub at `~/.promise/bin/promise` (`promise.exe` on Windows)
3. `promise` on PATH

The extension always launches the stub — never an epoch-specific binary directly. The stub reads the workspace `promise.toml` and dispatches to the pinned epoch's compiler under `~/.promise/epochs/{epoch}/bin/promise`. Respects `PROMISE_HOME` env var (mirrors the compiler's own resolution in `compiler/internal/module/home.go`).

On-disk layout under `~/.promise` (or `$PROMISE_HOME`): `bin/promise` (stub) + `active` (default epoch) + `epochs/{epoch}/bin/promise` (real per-epoch compiler) + `cache/blobs/` (shared content-addressed store).

### Compiler Install & Update (`src/installer.ts`, `src/release.ts`)
The release `promise` binary is self-contained and serves as its own installer. `src/installer.ts` (vscode-bound orchestration) downloads the **full** prebuild for the active channel, verifies its `SHA256SUMS` entry, gunzips it, and runs `<binary> install` to unpack it into the home layout. `src/release.ts` holds the pure, unit-tested helpers (asset-name mapping, GitHub release selection, `SHA256SUMS` parsing, epoch comparison, PATH detection) and the `SUBCOMMANDS` map.

- **Channels** (`promise.channel`): `stable` (side-by-side epochs, checked weekly) and `next` (bleeding edge, updated in place, checked daily). Names match the CLI (`promise update channel <stable|next>`). The setting seeds the bootstrap install; after install the channel is owned by the CLI and reported by `promise update check --json`. Releases come from GitHub (`promise.releaseRepo`, default `promise-language/promise`), honoring `GITHUB_TOKEN`.
- **Variants** (`promise.variant`): `full` (default, self-contained) or `thin` (fetches blobs on first use). `all` is not shipped yet.
- **Commands**: `promise.install` (bootstrap download + `<binary> install`), `promise.checkForUpdates` (`promise update check --json`, parsed → notify), `promise.update` (`promise update`), `promise.selectChannel` (`promise update channel <stable|next>`), `promise.useEpoch` (`promise use <epoch>` — activates a specific epoch, downloading on demand; a later `promise update` re-activates the channel's latest). The CLI arg vectors live in `SUBCOMMANDS`/`channelArgs`/`useEpochArgs` in `release.ts`. Mutating commands run in a terminal for live output; the check runs headless and its JSON is parsed by `parseUpdateCheck`.
- **Auto-update** (`promise.autoUpdate`): `off` / `notify` (default — parses the JSON check and prompts, never mutates silently) / `auto` (runs `promise update` when an update is available). The periodic check is a no-op until a compiler is installed.
- **PATH**: on first install the extension offers (never forces) to add `~/.promise/bin` to PATH — appending to the shell profile on macOS/Linux or the User `Path` env var on Windows.

### Document Formatting (`src/formatting.ts`)
Pipes document content to `promise format` via stdin. The formatter reads from stdin when invoked with no file arguments and writes formatted output to stdout. Format-on-save is handled by VS Code's native `editor.formatOnSave` mechanism — the extension sets this to `true` for Promise files by default via `configurationDefaults`. Users can disable it with `"[promise]": { "editor.formatOnSave": false }`. Errors are logged to the "Promise" output channel.

### Task Provider (`src/tasks.ts`)
Provides build/run/check/test/clean tasks. The `$promise` problem matcher parses compiler error output (`filename:line:col: message`) into VS Code diagnostics. The `test directory` task only appears when `promise.toml` is present in the workspace root.

## Conventions

- Use the VS Code extension API — avoid shelling out where the API provides the functionality
- TextMate grammar scopes should follow the [VS Code naming conventions](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide)
- Test grammar changes against the example files in the compiler repo's `examples/` and `tests/` directories (see the Project Overview for how to access that repo)
- Keep the grammar aligned with the ANTLR4 grammar at `compiler/grammar/PromiseLexer.g4` and `PromiseParser.g4` in the compiler repo
- When adding LSP features, the `promise` binary provides the backend — the extension is a thin client
