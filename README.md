# Promise Language — VS Code Extension

VS Code extension for the [Promise programming language](https://github.com/promise-language/promise) — a statically-typed, natively-compiled language.

Every editor integration drives the single `promise` tool — the one binary that
is the compiler, formatter, build system, test runner, and package manager. The
extension installs and updates it for you, so there's nothing to set up by hand.

## Features

- **Syntax Highlighting** — TextMate grammar for `.pr` files covering keywords, types, operators, string interpolation, backtick annotations, and comments
- **Snippets** — Common patterns: type declarations, error handling, test functions, generators, match blocks
- **Formatting** — Format on save (enabled by default for `.pr` files) and manual formatting via `promise format`
- **Build & Test Tasks** — `promise build`, `promise run`, `promise check`, and `promise test` as VS Code tasks, with a problem matcher that routes compiler errors into the Problems panel
- **Automatic Toolchain Management** — Installs the `promise` toolchain on first use and keeps it current — update channels (`stable`/`next`), side-by-side epochs, and notify-or-auto updates (see [Toolchain Commands & Settings](#toolchain-commands--settings))
- **Bracket Matching & Auto-closing** — Pairs for `{}`, `[]`, `()`, backtick annotations
- **Comment Toggling** — Line (`//`) and block (`/* */`) comments
- **Code Folding** — Region-based folding for type bodies, function bodies, match arms
- **File Icons** — `.pr` file icon

## Planned Features

- **Language Server Protocol (LSP)** — Diagnostics, completions, hover info, go-to-definition (via the `promise` binary)

## Requirements

- VS Code 1.85.0 or later
- The `promise` toolchain — the extension installs and updates it for you (no PATH setup required). To use an existing install instead, set `promise.compilerPath`.

## Toolchain Commands & Settings

The extension manages the `promise` toolchain — the single binary that is the
compiler, formatter, build system, test runner, and package manager. When it
can't find `promise`, it offers to install it; afterwards it checks for updates
(daily on `next`, weekly on `stable`) and applies them on your say-so. It always
runs the launcher stub at `~/.promise/bin/promise`, which dispatches to the epoch
pinned by the workspace's `promise.toml`.

### Commands

Run from the Command Palette (⇧⌘P / Ctrl+Shift+P):

| Command | Action |
|---------|--------|
| **Promise: Install Promise** | Download and install the toolchain (`<binary> install`) |
| **Promise: Check for Updates** | Report whether a newer epoch is available (`promise update check`) |
| **Promise: Update Promise** | Update to the channel's latest (`promise update`) |
| **Promise: Switch Update Channel** | Choose `stable` or `next` (`promise update channel`) |
| **Promise: Activate Epoch** | Switch the active epoch, downloading on demand (`promise use`) |

### Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `promise.compilerPath` | `promise` | Path to the `promise` binary. Defaults to the `~/.promise/bin/promise` stub, then `promise` on PATH. Respects `PROMISE_HOME`. |
| `promise.channel` | `stable` | Update channel: `stable` (side-by-side epochs, checked weekly) or `next` (bleeding edge, in place, checked daily). |
| `promise.autoUpdate` | `notify` | `off`, `notify` (prompt, never mutate silently), or `auto` (update automatically). |
| `promise.variant` | `full` | `full` (self-contained download) or `thin` (fetches blobs on first use). |
| `promise.releaseRepo` | `promise-language/promise` | GitHub `owner/repo` to download releases from. Honors `GITHUB_TOKEN`. |
| `promise.testTimeout` | `60s` | Timeout for test tasks. |
| `promise.testParallelism` | `0` | Parallel tests (`0` = number of CPUs). |

## File Associations

| Extension | Language ID |
|-----------|------------|
| `.pr`     | `promise`  |

## Install for Testing

### Option 1: Extension Development Host (recommended during development)

1. Clone the repository and open it in VS Code:
   ```bash
   git clone https://github.com/promise-language/vscode-promise
   code vscode-promise
   ```
2. Run `npm install && npm run compile`
3. Press **F5** — this launches a new VS Code window with the extension loaded
4. Open any `.pr` file in that window to test highlighting, snippets, etc.

### Option 2: Install from VSIX

```bash
# Build the VSIX package
npm install && npm run compile
npx vsce package       # produces promise-language-<version>.vsix

# Install it
code --install-extension promise-language-<version>.vsix
```

To uninstall: `code --uninstall-extension promise-language`

### Option 3: Symlink into extensions directory

```bash
npm install && npm run compile

# macOS / Linux
ln -s "$(pwd)" ~/.vscode/extensions/promise-language

# Windows (PowerShell, run as admin)
New-Item -ItemType SymbolicLink -Path "$env:USERPROFILE\.vscode\extensions\promise-language" -Target (Get-Location)
```

Restart VS Code after symlinking. To uninstall, remove the symlink.

## Publishing

The extension is published to two registries so it is offered automatically when
a `.pr` file is opened in any compatible editor:

- **[VS Code Marketplace](https://marketplace.visualstudio.com/)** — VS Code.
- **[Open VSX](https://open-vsx.org/)** — VS Codium, Cursor, Gitpod, and other
  open-source-friendly editors.

Because this extension contributes the `promise` language with the `.pr`
extension, once published each registry will surface it via the editor's
"recommended extension for this file type" prompt.

### One-time setup

1. **VS Code Marketplace publisher** — create the `promise-lang` publisher at
   <https://marketplace.visualstudio.com/manage>. To earn the verified-publisher
   badge, set the publisher's verified domain to `promise-lang.org` and add the
   `vscode-verification` DNS TXT record it provides.
2. **Azure DevOps PAT** — generate a Personal Access Token with the
   **Marketplace > Manage** scope (<https://dev.azure.com>). Store it as the
   `VSCE_PAT` repository secret.
3. **Open VSX token** — create an access token at <https://open-vsx.org>. Store
   it as the `OVSX_PAT` repository secret. Request ownership of the `promise-lang`
   namespace to verify it.

### Releasing

Releases are automated by [`.github/workflows/publish.yml`](.github/workflows/publish.yml):
bump the version, tag, and push — CI runs the tests, packages the extension, and
publishes to both registries.

```bash
npm version patch        # 0.2.0 → 0.2.1 (also creates a v0.2.1 git tag)
git push --follow-tags
```

To publish manually instead:

```bash
npm run package          # build promise-language-<version>.vsix
npm run publish          # vsce publish  (uses VSCE_PAT)
npm run publish:ovsx     # ovsx publish  (uses OVSX_PAT)
```

## Development

```bash
# Install dependencies
npm install

# Compile the extension
npm run compile

# Watch for changes
npm run watch

# Run grammar + unit tests
npm test

# Package the extension
npx vsce package
```

## Testing

Grammar tests use [`vscode-tmgrammar-test`](https://github.com/PanAeon/vscode-tmgrammar-test) to verify that Promise code gets the correct TextMate scopes. Test files live in `tests/grammar/` and use annotated `.pr.test` files. Unit tests in `tests/unit/` (Node's built-in test runner) cover the pure logic in `src/utils.ts` and `src/release.ts`.

```bash
npm test            # grammar + unit tests
npm run test:grammar
npm run test:unit
```

Each test file covers a specific area of the grammar:

| Test file | Coverage |
|-----------|----------|
| `comments.pr.test` | Line and block comments |
| `declarations.pr.test` | Type, enum, function declarations, generics |
| `annotations.pr.test` | Built-in, parameterized, and chained annotations |
| `keywords.pr.test` | Use imports, control flow, concurrency, contextual keywords |
| `types.pr.test` | Primitives, Self, collections, built-in parameterized types |
| `strings.pr.test` | Regular, raw, triple-quoted strings, escapes, interpolation, chars |
| `numerics.pr.test` | Integer/float literals, hex/octal/binary, suffixes, booleans, none |
| `operators.pr.test` | Arithmetic, comparison, logical, assignment, range, shift, bitwise, `as!` |
| `lambdas.pr.test` | Lambda with params, block body, `move \|\|` empty params |
| `type_members.pr.test` | Fields, constructors, methods, getters, setters, operator overloading, expression body |
| `parameters.pr.test` | Receiver types, regular params, variadic, references |
| `use_binding.pr.test` | Use binding pattern |

To add a new test, create a `.pr.test` file using the [vscode-tmgrammar-test assertion format](https://github.com/PanAeon/vscode-tmgrammar-test#writing-tests):
```
// SYNTAX TEST "source.promise"

type Foo {
// <-- keyword.declaration.type.promise
//   ^^^ entity.name.type.promise
}
```

## Extension Structure

```
vscode-promise/
├── package.json                   # Extension manifest
├── tsconfig.json                  # TypeScript configuration
├── src/
│   ├── extension.ts               # Activation entry point
│   ├── compiler.ts                # Launcher-stub resolution
│   ├── installer.ts               # Toolchain install/update orchestration
│   ├── release.ts                 # Pure install/update helpers (unit-tested)
│   ├── formatting.ts              # promise format integration
│   ├── tasks.ts                   # build/run/check/test tasks
│   └── utils.ts                   # Shared pure helpers (unit-tested)
├── syntaxes/
│   └── promise.tmLanguage.json    # TextMate grammar
├── language-configuration.json    # Brackets, comments, folding
├── snippets/
│   └── promise.json               # Code snippets
├── tests/
│   ├── grammar/                   # Grammar test suites (12 .pr.test files)
│   └── unit/                      # Unit tests for utils.ts / release.ts
├── icons/                         # File + extension icons
├── docs/
│   └── plan.md                    # Implementation plan
├── CLAUDE.md                      # AI agent guidance
└── README.md
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to build, test, and submit
changes.

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) or <http://www.apache.org/licenses/LICENSE-2.0>)
- MIT License ([LICENSE-MIT](LICENSE-MIT) or <http://opensource.org/licenses/MIT>)

at your option.
