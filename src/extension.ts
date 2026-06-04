import * as vscode from 'vscode';
import { PromiseDocumentFormattingProvider } from './formatting';
import { PromiseTaskProvider } from './tasks';
import { resolveCompilerPath, verifyCompiler } from './compiler';

const LANGUAGE_ID = 'promise';

export async function activate(context: vscode.ExtensionContext) {
	const outputChannel = vscode.window.createOutputChannel('Promise');
	context.subscriptions.push(outputChannel);

	// Resolve compiler and log result
	const compilerPath = resolveCompilerPath();
	const found = await verifyCompiler(compilerPath);
	if (found) {
		outputChannel.appendLine(`Promise compiler: ${compilerPath}`);
	} else {
		outputChannel.appendLine(`Promise compiler not found: ${compilerPath}`);
	}

	// Document formatting
	const formatter = new PromiseDocumentFormattingProvider(outputChannel);
	context.subscriptions.push(
		vscode.languages.registerDocumentFormattingEditProvider(LANGUAGE_ID, formatter)
	);

	// Task provider
	context.subscriptions.push(
		vscode.tasks.registerTaskProvider('promise', new PromiseTaskProvider())
	);

	outputChannel.appendLine('Promise Language extension activated');
}

export function deactivate() {}
