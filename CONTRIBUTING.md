# Contributing to the Promise VS Code Extension

Thanks for your interest in improving the Promise Language extension for VS
Code. This guide covers building, testing, and submitting changes.

For the language itself, see the [Promise
repository](https://github.com/promise-language/promise).

## Contributor License Agreement (CLA) required

This extension is part of the **Promise Lang** project, hosted in the
`promise-language` organization and maintained under Promise Lang LLC. Before
any pull request can be merged, you must sign the **Promise Lang Contributor
License Agreement**. When you open your first pull request, the CLA Assistant
bot will post a link to sign. You only need to sign once — it covers all future
contributions across the project.

- **Individual contributors** sign the Individual CLA.
- **Contributors acting on behalf of an employer** also have their employer sign
  the Corporate CLA.

You retain copyright in your contribution; the CLA grants Promise Lang LLC the
rights it needs to administer, distribute, and sublicense it as part of the
project.

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
5. Sign the CLA when the bot prompts you (see above) — it is a required check
   before merge.

## License of contributions

This project is dual-licensed under the [Apache License, Version
2.0](LICENSE-APACHE) and the [MIT License](LICENSE-MIT). By submitting a
contribution, you agree that your contribution is licensed under both licenses,
and that you have the right to license it under these terms.
