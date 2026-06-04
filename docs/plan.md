# Promise VS Code Extension — Implementation Plan

## Overview

This document describes the phased implementation plan for a VS Code extension providing full language support for the Promise programming language (`.pr` files). The plan is organized into four phases, each building on the previous one.

---

## Phase 1: Syntax Highlighting & Basic Editor Support ✓ COMPLETE

**Goal:** Provide a high-quality editing experience with syntax highlighting, bracket matching, and snippets — no compiler dependency required.

### 1.1 Project Scaffolding

- [x] Initialize `package.json` with extension manifest
  - Language ID: `promise`
  - File extension: `.pr`
  - Display name: "Promise Language"
  - Publisher, version, VS Code engine compatibility (`^1.85.0`)
  - Activation events: `onLanguage:promise`
  - Contribution points: languages, grammars, snippets, configuration
- [x] Set up TypeScript build with `tsconfig.json`
- [x] Create `src/extension.ts` entry point (activate/deactivate)
- [x] Add npm scripts: `compile`, `watch`, `lint`, `test`, `package`
- [x] Add `.vscodeignore` to exclude dev files from packaged extension

### 1.2 Language Configuration (`language-configuration.json`)

- [x] Comment toggling (line `//`, block `/* */`)
- [x] Bracket pairs: `{}`, `[]`, `()`
- [x] Auto-closing pairs: `{}`, `[]`, `()`, `""`, `''`
- [x] Surrounding pairs: `{}`, `[]`, `()`, `""`, `''`
- [x] Folding markers (region/endregion)
- [x] Word pattern: `[a-zA-Z_][a-zA-Z0-9_]*`
- [x] Indentation rules (increase after `{`, decrease at `}`)
- [x] On-enter rules

### 1.3 TextMate Grammar (`syntaxes/promise.tmLanguage.json`)

- [x] Comments: line (`//`) and block (`/* */`)
- [x] Keywords: control flow, declarations, modifiers, concurrency, error handling, property
- [x] Contextual keywords: `present`, `absent`, `default`
- [x] Constants: `true`, `false`, `none`, `this`, `super`, `Self`
- [x] Numeric literals: decimal, hex, octal, binary with optional suffixes
- [x] Float literals with optional suffixes
- [x] Strings: regular (with interpolation), raw, triple-quoted, character literals
- [x] Escape sequences and unicode escapes
- [x] Meta annotations: built-in (`\`public`, `\`test`, etc.), parameterized (`\`doc("...")`), custom
- [x] Type declarations: `type`, `enum`, inheritance (`is`), generic parameters
- [x] Function declarations: top-level with keyword exclusion, methods inside type bodies
- [x] Constructor (`new`), getters (`get`), setters (`set`)
- [x] Operator methods: `+`, `-`, `*`, `/`, `%`, `==`, `!=`, `<`, `>`, `<=`, `>=`, `[]`, `[]=`, `[:]`, `[:]=`, `..`, `..=`, `++`, `--`, `<<`, `>>`, `&`, `|`, `^`, `~()`, `-()`
- [x] Expression body syntax: `=> expr;`
- [x] Failable return type marker: `!`
- [x] Primitive types including `void` and `error`
- [x] User-defined types (PascalCase), `Self` type
- [x] Built-in collection/parameterized types: `map`, `stream`, `iter`, `channel`, `task`
- [x] All operators: arithmetic, comparison, logical, assignment, walrus, range, shift, bitwise, arrow, optional chaining, elvis, channel receive, `as!`
- [x] `use` declarations: simple, aliased, URL-sourced
- [x] `use` binding pattern: `use conn := expr;`
- [x] Lambda expressions: `|params|`, `move ||`, with negative lookahead for `||` (logical OR)
- [x] Enum variant references: `Type.Variant`
- [x] Parameter list: receiver types, borrow/move markers, variadic

### 1.4 Snippets (`snippets/promise.json`)

- [x] 40 snippets covering: `type`, `typeis`, `typev`, `types`, `enum`, `enumd`, `fn`, `fnf`, `method`, `methodm`, `methode`, `test`, `teste`, `main`, `mainf`, `if`, `ifl`, `ife`, `for`, `fori`, `forr`, `forc`, `while`, `match`, `err`, `errt`, `errtype`, `gen`, `use`, `chan`, `go`, `sel`, `get`, `gete`, `factory`, `new`, `doc`, `pub`, `lambda`, `lambdab`, `assert`, `pl`, `readfile`

### 1.5 File Icon

- [x] SVG icons for light and dark themes (`icons/promise-light.svg`, `icons/promise-dark.svg`)
- [x] Registered in `package.json` under language icon contribution

### 1.6 Testing

- [x] 12 grammar test suites using `vscode-tmgrammar-test` in `tests/grammar/`
- [x] Tests cover: declarations, annotations, keywords, types, strings, numerics, operators, lambdas, type members, parameters, comments, use binding
- [x] Grammar verified against real Promise source files from `../promise_lang/modules/std/` and `../promise_lang/tests/`
- [x] String interpolation nesting verified
- [x] Backtick annotation highlighting verified (including chained and parameterized)
- [x] Generic type parameter `[T]` handling verified
- [x] Function detection heuristic verified (keyword exclusion, constructor priority)
- [x] `npm test` runs all grammar tests

---

## Phase 2: Formatting & Build Tasks ✓ COMPLETE

**Goal:** Integrate with the `promise` compiler for formatting and build/test workflows.

### 2.1 Compiler Resolution (`src/compiler.ts`)

- [x] Epoch-aware side-by-side version support:
  1. If user explicitly configured `promise.compilerPath`, use that directly
  2. Read `promise.toml` from workspace root for `epoch` field
  3. If epoch found, look for `~/.promise/bin/promise-{epoch}` (versioned binary)
  4. Look for `~/.promise/bin/promise` (default installed location)
  5. Fall back to `promise` on PATH
- [x] Respects `PROMISE_HOME` environment variable
- [x] Compiler reachability verification on activation (logged to output channel)

### 2.2 Document Formatting (`src/formatting.ts`)

- [x] Register a `DocumentFormattingEditProvider` for language `promise`
- [x] On format, pipe document content to `promise format` via stdin (no temp files)
- [x] Format on save via `configurationDefaults` — sets `editor.formatOnSave: true` for Promise files
- [x] Handle formatting errors gracefully (logged to output channel, file not corrupted)
- [x] Cancellation support and 10-second timeout

### 2.3 Build Tasks (`src/tasks.ts`)

- [x] Provide task definitions via `TaskProvider`:
  - `promise: build` — `promise build ${file}`
  - `promise: run` — `promise run ${file}`
  - `promise: check` — `promise check ${file}` (type-check only)
  - `promise: test file` — `promise test ${file}`
  - `promise: test directory` — `promise test ${workspaceFolder}/tests/...`
  - `promise: clean` — `promise clean`
- [x] Auto-detect `promise.toml` in workspace for project-level tasks (`test directory` only shown when present)
- [x] Problem matcher for compiler error output format:
  - Pattern: `filename:line:col: error message`
  - Registered as `$promise` problem matcher in `package.json` with `autoDetect` file location
- [x] Test tasks respect `promise.testTimeout` and `promise.testParallelism` settings

### 2.4 Configuration

- [x] `promise.compilerPath` — Path to the `promise` binary (with epoch-aware resolution)
- [x] `editor.formatOnSave` — Defaulted to `true` for Promise files via `configurationDefaults`
- [x] `promise.testTimeout` — Default test timeout (default: `"60s"`)
- [x] `promise.testParallelism` — Number of parallel tests (default: `0` = compiler default)

---

## Phase 3: Language Server (LSP)

**Goal:** Rich IDE features powered by the `promise` compiler.

This phase depends on the `promise` compiler implementing an LSP server mode (e.g., `promise lsp`). The extension acts as a thin LSP client.

### 3.1 LSP Client Setup

- [ ] Add `vscode-languageclient` dependency
- [ ] Launch `promise lsp` as a child process on extension activation
- [ ] Handle server lifecycle (start, restart on crash, shutdown)
- [ ] Configuration: `promise.lsp.enabled` (default: `true`)

### 3.2 Diagnostic Features (from compiler)

- [ ] Real-time error/warning diagnostics as you type
- [ ] Type errors, ownership violations, unused variables
- [ ] Quick fixes where applicable (e.g., add missing `use`, add `!` to failable call)

### 3.3 Navigation Features

- [ ] Go to Definition — jump to type/function/field declarations
- [ ] Find References — find all usages of a symbol
- [ ] Document Symbols — outline view (types, enums, functions, methods)
- [ ] Workspace Symbols — search across all `.pr` files
- [ ] Hover Information — show type signatures, `` `doc `` annotations
- [ ] Signature Help — parameter hints while typing function calls

### 3.4 Completion Features

- [ ] Keyword completion
- [ ] Type name completion
- [ ] Field/method completion (context-aware, respects visibility)
- [ ] Module member completion after `module.`
- [ ] Import completion for `use` declarations
- [ ] Snippet-based completion for common patterns

### 3.5 Refactoring Features

- [ ] Rename Symbol — rename across all files in the module
- [ ] Code Actions — suggested fixes for diagnostics

---

## Phase 4: Advanced Features

**Goal:** Test runner integration, debugging support, and polish.

### 4.1 Test Runner Integration

- [ ] Implement `TestController` for VS Code's Test Explorer UI
- [ ] Discover tests by scanning for `` `test `` annotations in `.pr` files
- [ ] Run individual tests, test files, or entire test directories
- [ ] Display pass/fail results with timing information
- [ ] Parse test output format:
  ```
  PASS (0.001s) test_name
  FAIL (0.003s) test_name
    panic: assertion failed: ...
  ```
- [ ] Support stress testing mode (`promise test -stress`)
- [ ] CodeLens: "Run Test" / "Debug Test" above each `` `test `` function

### 4.2 Debugging Support (Future)

- [ ] DAP (Debug Adapter Protocol) integration if/when `promise` supports debugging
- [ ] Breakpoints in `.pr` files
- [ ] Variable inspection
- [ ] Call stack navigation

### 4.3 Semantic Highlighting (LSP-based)

- [ ] Augment TextMate grammar with semantic tokens from LSP
- [ ] Differentiate types, functions, variables, parameters, fields by semantic role
- [ ] Highlight ownership markers (`&`, `~`) based on resolved borrow semantics
- [ ] Highlight error-handling paths

### 4.4 Workspace Features

- [ ] Module structure view — show `promise.toml` modules in explorer
- [ ] Dependency tree visualization
- [ ] `promise.toml` schema validation and completion (if JSON/TOML extension supports it)

### 4.5 Polish

- [ ] Extension icon and marketplace listing
- [ ] Keyboard shortcuts for common operations
- [ ] Status bar: show `promise` compiler version
- [ ] Output channel for compiler/LSP logs
- [ ] Welcome/walkthrough page for new users

---

## Priority & Dependencies

```
Phase 1 (Syntax + Snippets)     ← No external dependencies, can ship immediately
    │
    ▼
Phase 2 (Format + Tasks)        ← Requires `promise` binary (~/.promise/bin/ or PATH)
    │
    ▼
Phase 3 (LSP)                   ← Requires `promise lsp` server mode in compiler
    │
    ▼
Phase 4 (Tests + Debug)         ← Requires LSP + test output parsing
```

## File Inventory

| File | Phase | Purpose |
|------|-------|---------|
| `package.json` | 1 | Extension manifest |
| `tsconfig.json` | 1 | TypeScript config |
| `.vscodeignore` | 1 | Package exclusions |
| `.gitignore` | 1 | Git exclusions |
| `src/extension.ts` | 1+2 | Entry point — activates formatter, tasks, compiler resolution |
| `src/compiler.ts` | 2 | Compiler binary resolution (vscode-dependent wiring) |
| `src/utils.ts` | 2 | Pure logic: epoch parsing, binary lookup, task args, verify |
| `src/formatting.ts` | 2 | Document formatting provider (pipes to `promise format`) |
| `src/tasks.ts` | 2 | Task provider (build, run, check, test, clean) |
| `syntaxes/promise.tmLanguage.json` | 1 | TextMate grammar (~900 lines) |
| `language-configuration.json` | 1 | Editor behavior |
| `snippets/promise.json` | 1 | Code snippets (40 snippets) |
| `icons/promise-light.svg` | 1 | File icon (light theme) |
| `icons/promise-dark.svg` | 1 | File icon (dark theme) |
| `tests/grammar/*.pr.test` | 1 | Grammar test suites (12 files) |
| `tests/unit/*.test.js` | 2 | Unit tests: epoch parsing, resolution, task args, problem matcher |
| `CLAUDE.md` | 1 | AI agent guidance |
| `README.md` | 1 | User documentation |
| `docs/plan.md` | 1 | Implementation plan |

## Grammar Design Notes

### Function Declaration Detection

Promise functions have no `fn`/`func` keyword. A function declaration looks like:

```
name(params) ReturnType { body }
name[T](params) ReturnType { body }
```

This is ambiguous with a function *call* (`name(args)`). The TextMate grammar uses these heuristics:
1. At statement level (start of line or after `}`), an identifier followed by `[` or `(` with a subsequent `{` is a declaration
2. Inside type bodies, methods are always declarations
3. Constructors are identified by `new(`

### Backtick Annotations vs String Backticks

The backtick `` ` `` in Promise is used for meta annotations, not template strings. The grammar treats `` ` `` followed by an identifier as an annotation. This doesn't conflict with any other syntax since Promise uses `{expr}` for string interpolation.

### Generic Brackets `[]` Ambiguity

`[` could be: generic params (`Box[int]`), array type (`int[3]`), vector sugar (`int[]`), indexing (`arr[0]`), or array literal (`[1,2,3]`). The grammar handles this by:
- After `type`/`enum` declarations and function names: generic parameters
- After a type reference: array/vector suffix
- After an expression: indexing
- At expression start: array literal

### String Interpolation Depth

Promise string interpolation `"hello {expr}"` can nest: `"outer {inner("{nested}")}". The TextMate grammar handles one level of nesting. Deeper nesting degrades gracefully (inner strings may not highlight interpolation correctly).
