import * as vscode from 'vscode';
import {
	getPromiseHome,
	findCompilerInHome,
	fileExists,
	verifyCompiler
} from './utils';

export { fileExists, verifyCompiler };

/**
 * Resolves the path to the promise launcher stub.
 *
 * Resolution order:
 * 1. User-configured `promise.compilerPath` (if explicitly changed from default)
 * 2. Launcher stub at ~/.promise/bin/promise (or promise.exe on Windows)
 * 3. `promise` on PATH
 *
 * The stub — not an epoch-specific binary — is always launched: it reads the
 * workspace `promise.toml` and dispatches to the pinned epoch itself.
 * Respects PROMISE_HOME env var for the install directory.
 */
export function resolveCompilerPath(): string {
	const config = vscode.workspace.getConfiguration('promise');
	const configured = config.get<string>('compilerPath', 'promise');

	// If user explicitly set a path (not the default), use it directly
	const inspect = config.inspect<string>('compilerPath');
	if (inspect?.workspaceValue || inspect?.workspaceFolderValue || inspect?.globalValue) {
		return configured;
	}

	const found = findCompilerInHome(getPromiseHome());
	if (found) {
		return found;
	}

	// Fall back to PATH
	return 'promise';
}
