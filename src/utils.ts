import * as path from 'path';
import * as fs from 'fs';
import { execFile } from 'child_process';

/**
 * Parses the epoch value from a promise.toml file.
 * Handles both [module] and [catalog] sections.
 */
export function parseEpochFromToml(filePath: string): string | null {
	try {
		const content = fs.readFileSync(filePath, 'utf-8');
		return parseEpochString(content);
	} catch {
		return null;
	}
}

/**
 * Extracts the epoch value from TOML content.
 * Looks for `epoch = "..."` lines in any section.
 */
export function parseEpochString(content: string): string | null {
	const match = content.match(/^\s*epoch\s*=\s*"([^"]+)"/m);
	return match ? match[1] : null;
}

/**
 * Returns the Promise home directory.
 * Uses PROMISE_HOME env var if set, otherwise ~/.promise/
 */
export function getPromiseHome(): string {
	const envHome = process.env['PROMISE_HOME'];
	if (envHome) {
		return envHome;
	}
	const home = process.env['HOME'] || process.env['USERPROFILE'] || '';
	return path.join(home, '.promise');
}

/**
 * Checks if a file exists and is a regular file.
 */
export function fileExists(filePath: string): boolean {
	try {
		const stat = fs.statSync(filePath);
		return stat.isFile();
	} catch {
		return false;
	}
}

/**
 * Looks for the promise compiler binary in the given home directory.
 * Returns the path to the binary if found, null otherwise.
 *
 * Resolution: epoch-specific binary first, then default binary.
 */
export function findCompilerInHome(promiseHome: string, epoch: string | null): string | null {
	const binDir = path.join(promiseHome, 'bin');

	if (epoch) {
		const epochBinary = path.join(binDir, `promise-${epoch}`);
		if (fileExists(epochBinary)) {
			return epochBinary;
		}
	}

	const defaultBinary = path.join(binDir, 'promise');
	if (fileExists(defaultBinary)) {
		return defaultBinary;
	}

	return null;
}

export interface TaskArgs {
	args: string[];
	label: string;
}

/**
 * Builds the CLI arguments and label for a given task name.
 */
export function buildTaskArgs(
	taskName: string,
	testTimeout: string,
	testParallelism: number
): TaskArgs {
	switch (taskName) {
		case 'build':
			return { args: ['build', '${file}'], label: 'promise: build' };
		case 'run':
			return { args: ['run', '${file}'], label: 'promise: run' };
		case 'check':
			return { args: ['check', '${file}'], label: 'promise: check' };
		case 'test file': {
			const args = ['test', '-timeout', testTimeout];
			if (testParallelism > 0) {
				args.push('-parallel', String(testParallelism));
			}
			args.push('${file}');
			return { args, label: 'promise: test file' };
		}
		case 'test directory': {
			const args = ['test', '-timeout', testTimeout];
			if (testParallelism > 0) {
				args.push('-parallel', String(testParallelism));
			}
			args.push('${workspaceFolder}/tests/...');
			return { args, label: 'promise: test directory' };
		}
		case 'clean':
			return { args: ['clean'], label: 'promise: clean' };
		default:
			return { args: [taskName], label: `promise: ${taskName}` };
	}
}

/**
 * Verifies the compiler is reachable by running it with no args.
 * Returns true if the binary is executable, false otherwise.
 */
export function verifyCompiler(compilerPath: string): Promise<boolean> {
	return new Promise((resolve) => {
		execFile(compilerPath, [], { timeout: 5000 }, (error) => {
			if (error && typeof error.code === 'string') {
				// System error (ENOENT, EACCES, etc.) — binary not found or not executable
				resolve(false);
			} else {
				// Either no error or non-zero exit (which still means the binary ran)
				resolve(true);
			}
		});
	});
}
