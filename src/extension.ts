import * as vscode from 'vscode';
import { PromiseDocumentFormattingProvider } from './formatting';
import { PromiseTaskProvider } from './tasks';
import { resolveCompilerPath, verifyCompiler } from './compiler';
import { registerInstaller, maybeOfferInstall, schedulePeriodicCheck } from './installer';

const LANGUAGE_ID = 'promise';

export async function activate(context: vscode.ExtensionContext) {
	const outputChannel = vscode.window.createOutputChannel('Promise');
	context.subscriptions.push(outputChannel);

	// Promise install/update commands
	registerInstaller(context, outputChannel);

	// Document formatting
	const formatter = new PromiseDocumentFormattingProvider(outputChannel);
	context.subscriptions.push(
		vscode.languages.registerDocumentFormattingEditProvider(LANGUAGE_ID, formatter)
	);

	// Task provider
	context.subscriptions.push(
		vscode.tasks.registerTaskProvider('promise', new PromiseTaskProvider())
	);

	// Schedule periodic update checks (no-op until Promise is installed)
	schedulePeriodicCheck(context, outputChannel);

	outputChannel.appendLine('Promise Language extension activated');

	// Resolve the promise binary; offer to install it if it cannot be found.
	// Not awaited: the install prompt must not block activation from completing.
	const compilerPath = resolveCompilerPath();
	const found = await verifyCompiler(compilerPath);
	if (found) {
		outputChannel.appendLine(`Promise binary: ${compilerPath}`);
	} else {
		outputChannel.appendLine(`Promise binary not found: ${compilerPath}`);
		void maybeOfferInstall(context, outputChannel);
	}
}

export function deactivate() {}
