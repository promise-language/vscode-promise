import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { resolveCompilerPath } from './compiler';

export class PromiseDocumentFormattingProvider implements vscode.DocumentFormattingEditProvider {
	private outputChannel: vscode.OutputChannel;

	constructor(outputChannel: vscode.OutputChannel) {
		this.outputChannel = outputChannel;
	}

	async provideDocumentFormattingEdits(
		document: vscode.TextDocument,
		_options: vscode.FormattingOptions,
		token: vscode.CancellationToken
	): Promise<vscode.TextEdit[]> {
		const compilerPath = resolveCompilerPath();
		const source = document.getText();

		try {
			const formatted = await this.runFormat(compilerPath, source, token);
			if (formatted === null || formatted === source) {
				return [];
			}

			const fullRange = new vscode.Range(
				document.positionAt(0),
				document.positionAt(source.length)
			);
			return [vscode.TextEdit.replace(fullRange, formatted)];
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			this.outputChannel.appendLine(`[format] ${message}`);
			return [];
		}
	}

	private runFormat(
		compilerPath: string,
		source: string,
		token: vscode.CancellationToken
	): Promise<string | null> {
		return new Promise((resolve, reject) => {
			const proc = execFile(
				compilerPath,
				['format'],
				{ timeout: 10000 },
				(error, stdout, stderr) => {
					disposable.dispose();
					if (error) {
						if (error.killed) {
							reject(new Error('Format timed out'));
						} else {
							reject(new Error(stderr || error.message));
						}
						return;
					}
					resolve(stdout);
				}
			);

			const disposable = token.onCancellationRequested(() => {
				proc.kill();
				resolve(null);
			});

			proc.stdin?.write(source);
			proc.stdin?.end();
		});
	}
}
