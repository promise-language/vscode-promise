# Contributing to the Promise VS Code Extension

Thanks for your interest in improving the Promise Language extension for VS
Code. This guide covers building, testing, and submitting changes.

For the language itself, see the [Promise
repository](https://github.com/promise-language/promise).

## Prerequisites

- [Node.js](https://nodejs.org/) 18+ and npm
- VS Code 1.85.0 or later
- (Optional) The `promise` compiler binary on your `PATH` for testing the
  formatting, task, and compiler-path features

## Getting started

```sh
npm install        # install dependencies
npm run compile    # build TypeScript -> out/
npm run watch      # rebuild on change (during development)
```

To try the extension in a live editor, open this folder in VS Code and press
**F5**. This launches an Extension Development Host window with the extension
loaded; open any `.pr` file to exercise highlighting, snippets, and tasks.

## Testing

```sh
npm test           # grammar tests (vscode-tmgrammar-test) + unit tests
npm run test:grammar
npm run test:unit
```

- **Grammar tests** live in `tests/grammar/*.pr.test` and assert TextMate
  scopes against the grammar in `syntaxes/promise.tmLanguage.json`. They use the
  [vscode-tmgrammar-test](https://github.com/PanAeon/vscode-tmgrammar-test)
  assertion format.
- **Unit tests** live in `tests/unit/*.test.js` and run under `node --test`.

When you change the grammar, add or update a grammar test that covers the new
scope. When you change `src/`, add or update a unit test where practical.

## Submitting changes

1. Fork the repository and create a topic branch.
2. Make your change, keeping it focused and consistent with the surrounding
   code style.
3. Ensure `npm run compile` and `npm test` both pass.
4. Open a pull request describing what changed and why.

## License of contributions

This project is dual-licensed under the [Apache License, Version
2.0](LICENSE-APACHE) and the [MIT License](LICENSE-MIT). By submitting a
contribution, you agree that your contribution is licensed under both licenses,
and that you have the right to license it under these terms.
