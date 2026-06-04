import * as vscode from 'vscode';
import * as path from 'path';
import { resolveCompilerPath, fileExists } from './compiler';
import { buildTaskArgs } from './utils';

const TASK_SOURCE = 'promise';

interface PromiseTaskDefinition extends vscode.TaskDefinition {
	task: string;
}

export class PromiseTaskProvider implements vscode.TaskProvider {

	provideTasks(): vscode.Task[] {
		const folders = vscode.workspace.workspaceFolders;
		if (!folders) {
			return [];
		}

		const tasks: vscode.Task[] = [];
		const compilerPath = resolveCompilerPath();

		for (const folder of folders) {
			const hasToml = fileExists(path.join(folder.uri.fsPath, 'promise.toml'));
			tasks.push(...this.createTasks(compilerPath, folder, hasToml));
		}

		return tasks;
	}

	resolveTask(task: vscode.Task): vscode.Task | undefined {
		const definition = task.definition as PromiseTaskDefinition;
		if (!definition.task) {
			return undefined;
		}

		const compilerPath = resolveCompilerPath();
		const scope = task.scope;

		// resolveTask is only called for tasks from tasks.json, where scope
		// is always a WorkspaceFolder. Pass undefined for Global/Workspace scopes.
		const folder = (scope !== undefined &&
			scope !== vscode.TaskScope.Global &&
			scope !== vscode.TaskScope.Workspace)
			? scope
			: undefined;

		return this.buildTask(compilerPath, definition.task, folder);
	}

	private createTasks(
		compilerPath: string,
		folder: vscode.WorkspaceFolder,
		hasToml: boolean
	): vscode.Task[] {
		const tasks: vscode.Task[] = [];

		tasks.push(this.buildTask(compilerPath, 'build', folder));
		tasks.push(this.buildTask(compilerPath, 'run', folder));
		tasks.push(this.buildTask(compilerPath, 'check', folder));
		tasks.push(this.buildTask(compilerPath, 'test file', folder));
		tasks.push(this.buildTask(compilerPath, 'clean', folder));

		if (hasToml) {
			tasks.push(this.buildTask(compilerPath, 'test directory', folder));
		}

		return tasks;
	}

	private buildTask(
		compilerPath: string,
		taskName: string,
		folder?: vscode.WorkspaceFolder
	): vscode.Task {
		const definition: PromiseTaskDefinition = { type: TASK_SOURCE, task: taskName };
		const config = vscode.workspace.getConfiguration('promise');
		const testTimeout = config.get<string>('testTimeout', '60s');
		const testParallelism = config.get<number>('testParallelism', 0);

		const { args, label } = buildTaskArgs(taskName, testTimeout, testParallelism);

		const execution = new vscode.ShellExecution(compilerPath, args);
		const task = new vscode.Task(
			definition,
			folder ?? vscode.TaskScope.Workspace,
			label,
			TASK_SOURCE,
			execution,
			'$promise'
		);

		// Build/check/test tasks show errors in the Problems panel
		if (taskName !== 'run' && taskName !== 'clean') {
			task.group = vscode.TaskGroup.Build;
		}

		task.presentationOptions = {
			reveal: vscode.TaskRevealKind.Always,
			panel: vscode.TaskPanelKind.Shared,
		};

		return task;
	}
}
