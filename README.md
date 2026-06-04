# Promise Language — VS Code Extension

VS Code extension providing language support for the [Promise programming language](https://github.com/promise-language/promise) — a statically-typed systems language with Dart-inspired syntax and Rust-inspired ownership semantics.

## Features

- **Syntax Highlighting** — TextMate grammar for `.pr` files covering keywords, types, operators, string interpolation, backtick annotations, and comments
- **Snippets** — Common patterns: type declarations, error handling, test functions, generators, match blocks
- **Bracket Matching & Auto-closing** — Pairs for `{}`, `[]`, `()`, backtick annotations
- **Comment Toggling** — Line (`//`) and block (`/* */`) comments
- **Code Folding** — Region-based folding for type bodies, function bodies, match arms
- **File Icons** — `.pr` file icon

## Planned Features

- **Language Server Protocol (LSP)** — Diagnostics, completions, hover info, go-to-definition (via `promise` compiler)
- **Formatting** — Integration with `promise format`
- **Test Runner** — Run/debug tests via `promise test` from the editor
- **Build Tasks** — `promise build`, `promise run`, `promise check` as VS Code tasks

## Requirements

- VS Code 1.85.0 or later
- The `promise` compiler binary on your PATH (for LSP and formatting features)

## File Associations

| Extension | Language ID |
|-----------|------------|
| `.pr`     | `promise`  |

## Install for Testing

### Option 1: Extension Development Host (recommended during development)

1. Open the `promise_vscode/` folder in VS Code
2. Run `npm install && npm run compile`
3. Press **F5** — this launches a new VS Code window with the extension loaded
4. Open any `.pr` file in that window to test highlighting, snippets, etc.

### Option 2: Install from VSIX

```bash
# Build the VSIX package
npm install && npm run compile
npx vsce package       # produces promise-language-0.1.0.vsix

# Install it
code --install-extension promise-language-0.1.0.vsix
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

# Run grammar tests
npm test

# Package the extension
npx vsce package
```

## Testing

Grammar tests use [`vscode-tmgrammar-test`](https://github.com/PanAeon/vscode-tmgrammar-test) to verify that Promise code gets the correct TextMate scopes. Test files live in `tests/grammar/` and use annotated `.pr.test` files.

```bash
npm test    # runs all 12 grammar test suites
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
promise_vscode/
├── package.json                   # Extension manifest
├── tsconfig.json                  # TypeScript configuration
├── src/
│   └── extension.ts               # Extension entry point
├── syntaxes/
│   └── promise.tmLanguage.json    # TextMate grammar
├── language-configuration.json    # Brackets, comments, folding
├── snippets/
│   └── promise.json               # Code snippets
├── tests/
│   └── grammar/                   # Grammar test suites (12 files)
│       ├── declarations.pr.test
│       ├── annotations.pr.test
│       ├── keywords.pr.test
│       ├── types.pr.test
│       ├── strings.pr.test
│       ├── numerics.pr.test
│       ├── operators.pr.test
│       ├── lambdas.pr.test
│       ├── type_members.pr.test
│       ├── parameters.pr.test
│       ├── comments.pr.test
│       └── use_binding.pr.test
├── icons/                         # File icons (light/dark)
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
