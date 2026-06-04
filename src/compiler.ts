import * as vscode from 'vscode';
import {
	getPromiseHome,
	parseEpochFromToml,
	findCompilerInHome,
	fileExists,
	verifyCompiler
} from './utils';
import * as path from 'path';

export { fileExists, verifyCompiler };

/**
 * Resolves the path to the promise compiler binary.
 *
 * Resolution order:
 * 1. User-configured `promise.compilerPath` (if explicitly changed from default)
 * 2. Epoch-specific binary at ~/.promise/bin/promise-{epoch} (if promise.toml has epoch)
 * 3. Default binary at ~/.promise/bin/promise
 * 4. `promise` on PATH
 *
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

	const promiseHome = getPromiseHome();
	const epoch = readWorkspaceEpoch();

	const found = findCompilerInHome(promiseHome, epoch);
	if (found) {
		return found;
	}

	// Fall back to PATH
	return 'promise';
}

/**
 * Reads the epoch field from promise.toml in the workspace root.
 * Returns null if no workspace, no promise.toml, or no epoch field.
 */
function readWorkspaceEpoch(): string | null {
	const folders = vscode.workspace.workspaceFolders;
	if (!folders || folders.length === 0) {
		return null;
	}

	for (const folder of folders) {
		const tomlPath = path.join(folder.uri.fsPath, 'promise.toml');
		const epoch = parseEpochFromToml(tomlPath);
		if (epoch) {
			return epoch;
		}
	}

	return null;
}
