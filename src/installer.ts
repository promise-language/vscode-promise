import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { execFile } from 'child_process';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { resolveCompilerPath, fileExists } from './compiler';
import { getPromiseHome } from './utils';
import {
	Channel,
	Variant,
	GitHubRelease,
	UpdateCheck,
	SUBCOMMANDS,
	channelArgs,
	useEpochArgs,
	parseUpdateCheck,
	assetName,
	parseSha256Sums,
	selectRelease,
	pathContainsDir,
} from './release';

const USER_AGENT = 'vscode-promise-language';
const DAY_MS = 24 * 60 * 60 * 1000;

// globalState keys
const KEY_LAST_CHECK = 'promise.lastUpdateCheck';
const KEY_INSTALL_DISMISSED = 'promise.installPromptDismissed';
const KEY_PATH_DISMISSED = 'promise.pathPromptDismissed';

type AutoUpdate = 'off' | 'notify' | 'auto';

function config(): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration('promise');
}

function getChannel(): Channel {
	return config().get<Channel>('channel', 'stable');
}

function getVariant(): Variant {
	return config().get<Variant>('variant', 'full');
}

function getReleaseRepo(): string {
	return config().get<string>('releaseRepo', 'promise-language/promise');
}

function getAutoUpdate(): AutoUpdate {
	return config().get<AutoUpdate>('autoUpdate', 'notify');
}

/** Daily checks for the in-place `next` channel, weekly for `stable`. */
function checkIntervalMs(channel: Channel): number {
	return channel === 'next' ? DAY_MS : 7 * DAY_MS;
}

function stubName(): string {
	return process.platform === 'win32' ? 'promise.exe' : 'promise';
}

/** True when a promise launcher stub already exists under PROMISE_HOME. */
function isInstalled(): boolean {
	return fileExists(path.join(getPromiseHome(), 'bin', stubName()));
}

/** Guards CLI commands that need an installed toolchain; warns if absent. */
function requireInstalled(): boolean {
	if (isInstalled()) {
		return true;
	}
	vscode.window.showWarningMessage(
		'Promise is not installed yet. Run "Promise: Install Promise" first.'
	);
	return false;
}

/** Lists the locally installed epochs (directory names under epochs/). */
function listInstalledEpochs(): string[] {
	const epochsDir = path.join(getPromiseHome(), 'epochs');
	try {
		return fs
			.readdirSync(epochsDir, { withFileTypes: true })
			.filter((e) => e.isDirectory())
			.map((e) => e.name)
			.sort();
	} catch {
		return [];
	}
}

/** Reads the active (default) epoch from PROMISE_HOME/active, or null. */
function getActiveEpoch(): string | null {
	try {
		const active = fs.readFileSync(path.join(getPromiseHome(), 'active'), 'utf-8').trim();
		return active || null;
	} catch {
		return null;
	}
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerInstaller(
	context: vscode.ExtensionContext,
	outputChannel: vscode.OutputChannel
): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('promise.install', () =>
			installPromise(context, outputChannel)
		),
		vscode.commands.registerCommand('promise.checkForUpdates', () =>
			checkForUpdatesCommand(outputChannel)
		),
		vscode.commands.registerCommand('promise.update', () => {
			if (requireInstalled()) {
				runCliCommand(SUBCOMMANDS.update);
			}
		}),
		vscode.commands.registerCommand('promise.selectChannel', () =>
			selectChannel()
		),
		vscode.commands.registerCommand('promise.useEpoch', () =>
			useEpoch()
		)
	);
}

/**
 * Offers to bootstrap-install Promise when it could not be found.
 * Respects a "Don't ask again" dismissal stored in globalState.
 */
export async function maybeOfferInstall(
	context: vscode.ExtensionContext,
	outputChannel: vscode.OutputChannel
): Promise<void> {
	if (context.globalState.get<boolean>(KEY_INSTALL_DISMISSED)) {
		return;
	}
	const choice = await vscode.window.showInformationMessage(
		'Promise was not found. Install it now?',
		'Install',
		'Not now',
		"Don't ask again"
	);
	if (choice === 'Install') {
		await installPromise(context, outputChannel);
	} else if (choice === "Don't ask again") {
		await context.globalState.update(KEY_INSTALL_DISMISSED, true);
	}
}

// ---------------------------------------------------------------------------
// Bootstrap install (extension owns the download; the binary unpacks itself)
// ---------------------------------------------------------------------------

/**
 * Downloads the full (self-contained) release binary for the active channel,
 * verifies its checksum, and runs `<binary> install` to unpack the toolchain
 * into PROMISE_HOME. Returns true on success.
 */
async function installPromise(
	context: vscode.ExtensionContext,
	outputChannel: vscode.OutputChannel
): Promise<boolean> {
	const channel = getChannel();
	const variant = getVariant();
	const repo = getReleaseRepo();
	const asset = assetName(process.platform, process.arch, variant);

	if (!asset) {
		const msg = `Unsupported platform for Promise: ${process.platform}/${process.arch}`;
		outputChannel.appendLine(`[install] ${msg}`);
		vscode.window.showErrorMessage(`Promise: ${msg}`);
		return false;
	}

	return vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title: `Installing Promise (${channel})`,
			cancellable: false,
		},
		async (progress) => {
			const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promise-install-'));
			try {
				progress.report({ message: 'Resolving release…' });
				const release = await resolveRelease(repo, channel);

				const assetObj = release.assets.find((a) => a.name === asset);
				if (!assetObj) {
					throw new Error(`Release ${release.tag_name} has no asset "${asset}"`);
				}

				const gzPath = path.join(tmpDir, asset);
				progress.report({ message: `Downloading ${asset}…` });
				outputChannel.appendLine(`[install] downloading ${assetObj.browser_download_url}`);
				await downloadFile(assetObj.browser_download_url, gzPath);

				await verifyChecksum(release, asset, gzPath, tmpDir, progress, outputChannel);

				progress.report({ message: 'Unpacking…' });
				const isWin = process.platform === 'win32';
				const binPath = path.join(tmpDir, isWin ? 'promise.exe' : 'promise');
				await gunzipFile(gzPath, binPath);
				if (!isWin) {
					fs.chmodSync(binPath, 0o755);
				}

				progress.report({ message: 'Running installer…' });
				const result = await execPromise(binPath, [...SUBCOMMANDS.install]);
				appendProcessOutput(outputChannel, '[install]', result);

				outputChannel.appendLine(`[install] installed ${release.tag_name}`);
				vscode.window.showInformationMessage(
					`Promise installed (${release.tag_name}).`
				);
				// Not awaited: let the install progress close before prompting for PATH.
				void offerPathSetup(context, outputChannel);
				return true;
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				outputChannel.appendLine(`[install] error: ${message}`);
				vscode.window.showErrorMessage(`Promise install failed: ${message}`);
				return false;
			} finally {
				try {
					fs.rmSync(tmpDir, { recursive: true, force: true });
				} catch {
					/* best-effort cleanup */
				}
			}
		}
	);
}

/** Resolves the GitHub release to install for the given channel. */
async function resolveRelease(repo: string, channel: Channel): Promise<GitHubRelease> {
	const releases = await fetchReleases(repo);
	const release = selectRelease(releases, channel);
	if (!release) {
		throw new Error(`No "${channel}" release found in ${repo}`);
	}
	return release;
}

async function verifyChecksum(
	release: GitHubRelease,
	asset: string,
	gzPath: string,
	tmpDir: string,
	progress: vscode.Progress<{ message?: string }>,
	outputChannel: vscode.OutputChannel
): Promise<void> {
	const sumsObj = release.assets.find((a) => a.name === 'SHA256SUMS');
	if (!sumsObj) {
		outputChannel.appendLine(
			'[install] warning: release has no SHA256SUMS asset; skipping verification'
		);
		return;
	}

	progress.report({ message: 'Verifying checksum…' });
	const sumsPath = path.join(tmpDir, 'SHA256SUMS');
	await downloadFile(sumsObj.browser_download_url, sumsPath);
	const sums = parseSha256Sums(fs.readFileSync(sumsPath, 'utf-8'));
	const expected = sums.get(asset);

	if (!expected) {
		outputChannel.appendLine(`[install] warning: no checksum for ${asset} in SHA256SUMS`);
		return;
	}

	const actual = await sha256File(gzPath);
	if (actual !== expected) {
		throw new Error(`Checksum mismatch for ${asset}: expected ${expected}, got ${actual}`);
	}
	outputChannel.appendLine('[install] checksum verified');
}

// ---------------------------------------------------------------------------
// CLI passthrough (update / check / channel — run via the launcher stub)
// ---------------------------------------------------------------------------

/**
 * Runs `promise <args...>` in a dedicated terminal so the user sees live output
 * (downloads, progress). Used for mutating operations (update, channel switch).
 */
function runCliCommand(args: readonly string[]): void {
	const stub = resolveCompilerPath();
	const terminal = vscode.window.createTerminal({ name: 'Promise' });
	terminal.sendText([quoteCommand(stub), ...args].join(' '));
	terminal.show();
}

/**
 * Quotes an executable path for the active shell. A path with no spaces needs
 * nothing. A quoted path must be prefixed with `&` in PowerShell, where a
 * leading quoted string is a string literal rather than a command invocation.
 */
function quoteCommand(executable: string): string {
	if (!/\s/.test(executable)) {
		return executable;
	}
	const shell = (vscode.env.shell || '').toLowerCase();
	const isPowerShell = shell.includes('powershell') || shell.includes('pwsh');
	return `${isPowerShell ? '& ' : ''}"${executable}"`;
}

/** Runs `promise update check --json` and returns the parsed result. */
async function runUpdateCheck(): Promise<UpdateCheck> {
	const stub = resolveCompilerPath();
	const { stdout } = await execPromise(stub, [...SUBCOMMANDS.checkJson]);
	return parseUpdateCheck(stdout);
}

/** Builds the user-facing "X → Y" description of an available update. */
function updateSummary(result: UpdateCheck): string {
	const from = result.active || 'none';
	const to = result.latest || 'a new build';
	return `${from} → ${to}`;
}

/** User-invoked check: reports up-to-date or offers to update. */
async function checkForUpdatesCommand(outputChannel: vscode.OutputChannel): Promise<void> {
	if (!requireInstalled()) {
		return;
	}
	let result: UpdateCheck;
	try {
		result = await vscode.window.withProgress(
			{ location: vscode.ProgressLocation.Window, title: 'Checking for Promise updates…' },
			runUpdateCheck
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		outputChannel.appendLine(`[update] check failed: ${message}`);
		vscode.window.showErrorMessage(`Promise update check failed: ${message}`);
		return;
	}

	if (!result.updateAvailable) {
		vscode.window.showInformationMessage(
			`Promise is up to date (${result.active || 'not installed'}, ${result.channel} channel).`
		);
		return;
	}

	const choice = await vscode.window.showInformationMessage(
		`Promise update available: ${updateSummary(result)} (${result.channel} channel).`,
		'Update',
		'Later'
	);
	if (choice === 'Update') {
		runCliCommand(SUBCOMMANDS.update);
	}
}

/** Prompts for a channel, persists it, and runs the CLI channel switch. */
async function selectChannel(): Promise<void> {
	const current = getChannel();
	const pick = await vscode.window.showQuickPick(
		[
			{
				label: 'stable',
				description: 'Stable epochs, installed side-by-side (checked weekly)',
			},
			{
				label: 'next',
				description: 'Bleeding edge, updated in place (checked daily)',
			},
		],
		{ placeHolder: `Current channel: ${current}` }
	);
	if (!pick) {
		return;
	}
	const channel = pick.label as Channel;
	await config().update('channel', channel, vscode.ConfigurationTarget.Global);

	if (isInstalled()) {
		// `promise update channel <channel>` sets the channel and immediately follows it.
		runCliCommand(channelArgs(channel));
	} else {
		vscode.window.showInformationMessage(
			`Promise channel set to "${channel}". It will take effect when Promise is installed.`
		);
	}
}

const ENTER_EPOCH_ITEM = '$(edit) Enter an epoch…';

/**
 * Activates a specific epoch via `promise use <epoch>`, downloading it on
 * demand. Offers the installed epochs (marking the active one) plus free-text
 * entry. Note: a later `promise update` re-activates the channel's latest.
 */
async function useEpoch(): Promise<void> {
	if (!requireInstalled()) {
		return;
	}

	const active = getActiveEpoch();
	const installed = listInstalledEpochs();
	const items: vscode.QuickPickItem[] = installed.map((epoch) => ({
		label: epoch,
		description: epoch === active ? 'active' : undefined,
	}));
	items.push({ label: ENTER_EPOCH_ITEM });

	const pick = await vscode.window.showQuickPick(items, {
		placeHolder: active ? `Active epoch: ${active}` : 'Select an epoch to activate',
	});
	if (!pick) {
		return;
	}

	let epoch = pick.label;
	if (epoch === ENTER_EPOCH_ITEM) {
		const input = await vscode.window.showInputBox({
			prompt: 'Epoch to activate (downloaded on demand if not installed)',
			placeHolder: 'e.g. 2026.10',
			validateInput: (value) => (value.trim() ? null : 'Enter an epoch'),
		});
		if (!input) {
			return;
		}
		epoch = input.trim();
	}

	if (epoch === active) {
		vscode.window.showInformationMessage(`Promise epoch ${epoch} is already active.`);
		return;
	}

	// Runs in a terminal: the epoch may need downloading.
	runCliCommand(useEpochArgs(epoch));
}

// ---------------------------------------------------------------------------
// Periodic update checks
// ---------------------------------------------------------------------------

/**
 * Schedules periodic update checks: shortly after startup and then re-evaluated
 * on a coarse timer (the per-channel due interval is enforced inside the check).
 */
export function schedulePeriodicCheck(
	context: vscode.ExtensionContext,
	outputChannel: vscode.OutputChannel
): void {
	const run = () => {
		void periodicCheck(context, outputChannel);
	};
	const startup = setTimeout(run, 10_000);
	const interval = setInterval(run, 6 * 60 * 60 * 1000);
	context.subscriptions.push({
		dispose: () => {
			clearTimeout(startup);
			clearInterval(interval);
		},
	});
}

async function periodicCheck(
	context: vscode.ExtensionContext,
	outputChannel: vscode.OutputChannel
): Promise<void> {
	const auto = getAutoUpdate();
	if (auto === 'off' || !isInstalled()) {
		return;
	}

	const channel = getChannel();
	const last = context.globalState.get<number>(KEY_LAST_CHECK, 0);
	const now = Date.now();
	if (now - last < checkIntervalMs(channel)) {
		return;
	}
	await context.globalState.update(KEY_LAST_CHECK, now);

	let result: UpdateCheck;
	try {
		result = await runUpdateCheck();
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		outputChannel.appendLine(`[update] periodic check failed: ${message}`);
		return;
	}

	if (!result.updateAvailable) {
		outputChannel.appendLine(
			`[update] up to date (${result.active}, ${result.channel} channel)`
		);
		return;
	}

	if (auto === 'auto') {
		outputChannel.appendLine(`[update] auto-updating: ${updateSummary(result)}`);
		runCliCommand(SUBCOMMANDS.update);
		return;
	}

	// notify: surface the available update; never mutate without consent.
	const choice = await vscode.window.showInformationMessage(
		`Promise update available: ${updateSummary(result)} (${result.channel} channel).`,
		'Update',
		'Later'
	);
	if (choice === 'Update') {
		runCliCommand(SUBCOMMANDS.update);
	}
}

// ---------------------------------------------------------------------------
// PATH setup (offer, don't force)
// ---------------------------------------------------------------------------

async function offerPathSetup(
	context: vscode.ExtensionContext,
	outputChannel: vscode.OutputChannel
): Promise<void> {
	const binDir = path.join(getPromiseHome(), 'bin');
	const delimiter = process.platform === 'win32' ? ';' : ':';
	if (pathContainsDir(process.env['PATH'], binDir, delimiter)) {
		return;
	}
	if (context.globalState.get<boolean>(KEY_PATH_DISMISSED)) {
		return;
	}

	const choice = await vscode.window.showInformationMessage(
		`Add ${binDir} to your PATH so you can run \`promise\` from any terminal?`,
		'Add to PATH',
		'Not now',
		"Don't ask again"
	);
	if (choice === "Don't ask again") {
		await context.globalState.update(KEY_PATH_DISMISSED, true);
		return;
	}
	if (choice !== 'Add to PATH') {
		return;
	}

	try {
		if (process.platform === 'win32') {
			await addToPathWindows(binDir);
		} else {
			addToPathUnix(binDir, outputChannel);
		}
		vscode.window.showInformationMessage(
			'Added Promise to PATH. Restart your terminal for it to take effect.'
		);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		outputChannel.appendLine(`[path] error: ${message}`);
		vscode.window.showWarningMessage(
			`Could not update PATH automatically. Add "${binDir}" to your PATH manually.`
		);
	}
}

/** Picks the user's shell profile, falling back to ~/.profile. */
function shellProfilePath(): string {
	const home = process.env['HOME'] || os.homedir();
	const shell = process.env['SHELL'] || '';
	if (shell.includes('zsh')) {
		return path.join(home, '.zshrc');
	}
	if (shell.includes('bash')) {
		return path.join(home, '.bashrc');
	}
	return path.join(home, '.profile');
}

function addToPathUnix(binDir: string, outputChannel: vscode.OutputChannel): void {
	const profile = shellProfilePath();
	let existing = '';
	try {
		existing = fs.readFileSync(profile, 'utf-8');
	} catch {
		/* file may not exist yet */
	}
	if (existing.includes(binDir)) {
		return;
	}
	fs.appendFileSync(
		profile,
		`\n# Added by Promise Language extension\nexport PATH="${binDir}:$PATH"\n`
	);
	outputChannel.appendLine(`[path] appended PATH export to ${profile}`);
}

async function addToPathWindows(binDir: string): Promise<void> {
	// Update the User-scope Path env var, guarding against a duplicate entry.
	const script =
		`$p = [Environment]::GetEnvironmentVariable('Path', 'User'); ` +
		`if ($p -notlike '*${binDir}*') { ` +
		`[Environment]::SetEnvironmentVariable('Path', ($p.TrimEnd(';') + ';${binDir}'), 'User') }`;
	await execPromise('powershell', ['-NoProfile', '-Command', script]);
}

// ---------------------------------------------------------------------------
// IO primitives
// ---------------------------------------------------------------------------

function ghHeaders(extra?: Record<string, string>): Record<string, string> {
	const headers: Record<string, string> = { 'User-Agent': USER_AGENT, ...extra };
	const token = process.env['GITHUB_TOKEN'];
	if (token) {
		headers['Authorization'] = `Bearer ${token}`;
	}
	return headers;
}

async function fetchReleases(repo: string): Promise<GitHubRelease[]> {
	const url = `https://api.github.com/repos/${repo}/releases?per_page=100`;
	const res = await fetch(url, {
		headers: ghHeaders({ Accept: 'application/vnd.github+json' }),
	});
	if (!res.ok) {
		throw new Error(`GitHub API ${res.status} ${res.statusText} for ${url}`);
	}
	return (await res.json()) as GitHubRelease[];
}

async function downloadFile(url: string, dest: string): Promise<void> {
	const res = await fetch(url, { headers: ghHeaders(), redirect: 'follow' });
	if (!res.ok || !res.body) {
		throw new Error(`Download failed: ${res.status} ${res.statusText} for ${url}`);
	}
	await pipeline(Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]), fs.createWriteStream(dest));
}

async function gunzipFile(src: string, dest: string): Promise<void> {
	await pipeline(fs.createReadStream(src), zlib.createGunzip(), fs.createWriteStream(dest));
}

function sha256File(file: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const hash = crypto.createHash('sha256');
		const stream = fs.createReadStream(file);
		stream.on('error', reject);
		stream.on('data', (chunk) => hash.update(chunk));
		stream.on('end', () => resolve(hash.digest('hex')));
	});
}

interface ProcessOutput {
	stdout: string;
	stderr: string;
}

/** Runs a binary, rejecting on spawn failure or non-zero exit. */
function execPromise(file: string, args: string[]): Promise<ProcessOutput> {
	return new Promise((resolve, reject) => {
		execFile(
			file,
			args,
			{ timeout: 5 * 60 * 1000, maxBuffer: 16 * 1024 * 1024 },
			(error, stdout, stderr) => {
				if (error) {
					reject(new Error(stderr.trim() || stdout.trim() || error.message));
				} else {
					resolve({ stdout, stderr });
				}
			}
		);
	});
}

function appendProcessOutput(
	outputChannel: vscode.OutputChannel,
	prefix: string,
	output: ProcessOutput
): void {
	const text = `${output.stdout}${output.stderr}`.trim();
	if (text) {
		outputChannel.appendLine(`${prefix} ${text}`);
	}
}
