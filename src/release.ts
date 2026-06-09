// Pure, vscode-free helpers for locating, downloading, and installing the
// promise toolchain. Everything here is unit-tested via `out/release` — keep it
// free of `vscode` and side effects so it stays testable.

// Channel names match the `promise` CLI exactly (`promise update channel <stable|next>`).
export type Channel = 'stable' | 'next';
export type Variant = 'full' | 'thin';

/** Tag of the single, in-place-updated bleeding-edge ("next") prerelease. */
export const NEXT_TAG = 'epoch-next';
/** Prefix on every release tag, e.g. `epoch-2026.3`. */
export const EPOCH_TAG_PREFIX = 'epoch-';

/**
 * Argument vectors for the installed `promise` CLI, invoked by the extension's
 * install/update/check/channel commands. Centralized here as the single source
 * of truth for the CLI surface the extension depends on.
 */
export const SUBCOMMANDS = {
	/** Run on a freshly downloaded release binary to unpack it into PROMISE_HOME. */
	install: ['install'],
	/** Report update availability as JSON (read-only). */
	checkJson: ['update', 'check', '--json'],
	/** Follow the update channel: install + activate its latest epoch. */
	update: ['update'],
} as const;

/** `promise update channel <channel>` — sets the channel and immediately follows it. */
export function channelArgs(channel: Channel): string[] {
	return ['update', 'channel', channel];
}

/** `promise use <epoch>` — activate a specific epoch (downloads on demand). */
export function useEpochArgs(epoch: string): string[] {
	return ['use', epoch];
}

/** Parsed result of `promise update check --json` (update.go:220-227). */
export interface UpdateCheck {
	/** "stable" or "next". */
	channel: string;
	/** Active epoch, or "" if none installed. */
	active: string;
	/** Latest epoch (stable) or the literal "next" (next channel); may be absent. */
	latest?: string;
	/** The headline boolean. */
	updateAvailable: boolean;
	/** Locally recorded sha256 build-id (next channel only). */
	localBuild?: string;
	/** Remote platform-asset sha256 from SHA256SUMS (next channel only). */
	remoteBuild?: string;
}

/**
 * Parses the JSON emitted by `promise update check --json`.
 * Throws if the payload is not valid JSON or lacks the `updateAvailable` flag.
 */
export function parseUpdateCheck(stdout: string): UpdateCheck {
	const data = JSON.parse(stdout) as Record<string, unknown>;
	if (typeof data['updateAvailable'] !== 'boolean') {
		throw new Error('update check output missing "updateAvailable"');
	}
	return {
		channel: typeof data['channel'] === 'string' ? data['channel'] : '',
		active: typeof data['active'] === 'string' ? data['active'] : '',
		latest: typeof data['latest'] === 'string' ? data['latest'] : undefined,
		updateAvailable: data['updateAvailable'],
		localBuild: typeof data['localBuild'] === 'string' ? data['localBuild'] : undefined,
		remoteBuild: typeof data['remoteBuild'] === 'string' ? data['remoteBuild'] : undefined,
	};
}

/** A GitHub release asset (subset of the API response we use). */
export interface GitHubAsset {
	name: string;
	browser_download_url: string;
}

/** A GitHub release (subset of the API response we use). */
export interface GitHubRelease {
	tag_name: string;
	prerelease: boolean;
	draft: boolean;
	published_at: string;
	assets: GitHubAsset[];
}

/**
 * Maps Node's `process.platform`/`process.arch` to promise's release tokens.
 * Returns null for unsupported platforms.
 */
export function platformTokens(
	platform: string,
	arch: string
): { os: string; arch: string; exe: boolean } | null {
	let os: string;
	switch (platform) {
		case 'darwin': os = 'darwin'; break;
		case 'linux': os = 'linux'; break;
		case 'win32': os = 'windows'; break;
		default: return null;
	}

	let cpu: string;
	switch (arch) {
		case 'x64': cpu = 'amd64'; break;
		case 'arm64': cpu = 'arm64'; break;
		default: return null;
	}

	return { os, arch: cpu, exe: os === 'windows' };
}

/**
 * Builds the release asset filename for a platform/variant, e.g.
 * `promise-darwin-arm64-full.gz` or `promise-windows-amd64-full.exe.gz`.
 * Returns null for unsupported platforms. The bare (no `-full`) name is the
 * thin variant; `all` is not shipped yet.
 */
export function assetName(platform: string, arch: string, variant: Variant): string | null {
	const tokens = platformTokens(platform, arch);
	if (!tokens) {
		return null;
	}
	const variantSuffix = variant === 'full' ? '-full' : '';
	const exe = tokens.exe ? '.exe' : '';
	return `promise-${tokens.os}-${tokens.arch}${variantSuffix}${exe}.gz`;
}

/**
 * Parses a SHA256SUMS file into a map of filename -> lowercase hex digest.
 * Accepts both `<hash>  <file>` and `<hash> *<file>` (binary-mode) forms.
 */
export function parseSha256Sums(content: string): Map<string, string> {
	const sums = new Map<string, string>();
	for (const line of content.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed) {
			continue;
		}
		const match = trimmed.match(/^([0-9a-fA-F]{64})\s+\*?(.+)$/);
		if (match) {
			sums.set(match[2], match[1].toLowerCase());
		}
	}
	return sums;
}

/** Strips the `epoch-` prefix from a release tag, or null if not an epoch tag. */
export function epochFromTag(tag: string): string | null {
	return tag.startsWith(EPOCH_TAG_PREFIX) ? tag.slice(EPOCH_TAG_PREFIX.length) : null;
}

/** Parses an epoch like "2026.3" or "2026.3.1" into numeric segments, or null. */
export function parseEpochSegments(epoch: string): number[] | null {
	const segments = epoch.split('.').map((part) => Number(part));
	if (segments.length === 0 || segments.some((n) => !Number.isInteger(n) || n < 0)) {
		return null;
	}
	return segments;
}

/**
 * Compares two epoch strings numerically by segment.
 * Returns >0 if a > b, <0 if a < b, 0 if equal. Unparseable epochs sort lowest.
 */
export function compareEpochs(a: string, b: string): number {
	const sa = parseEpochSegments(a);
	const sb = parseEpochSegments(b);
	if (!sa && !sb) { return 0; }
	if (!sa) { return -1; }
	if (!sb) { return 1; }

	const len = Math.max(sa.length, sb.length);
	for (let i = 0; i < len; i++) {
		const diff = (sa[i] ?? 0) - (sb[i] ?? 0);
		if (diff !== 0) {
			return diff > 0 ? 1 : -1;
		}
	}
	return 0;
}

/**
 * Selects the release matching a channel from a list of GitHub releases.
 * - `next`: the `epoch-next` prerelease.
 * - `stable`: the highest-epoch non-prerelease `epoch-<x>` tag (excludes next).
 * Drafts are always ignored. Returns null if no match.
 */
export function selectRelease(releases: GitHubRelease[], channel: Channel): GitHubRelease | null {
	const live = releases.filter((r) => !r.draft);

	if (channel === 'next') {
		return live.find((r) => r.tag_name === NEXT_TAG) ?? null;
	}

	const stable = live.filter(
		(r) => !r.prerelease && r.tag_name !== NEXT_TAG && epochFromTag(r.tag_name) !== null
	);
	if (stable.length === 0) {
		return null;
	}
	stable.sort((a, b) => compareEpochs(epochFromTag(b.tag_name)!, epochFromTag(a.tag_name)!));
	return stable[0];
}

/**
 * Returns true if `binDir` is already an entry in a PATH-style env string.
 * Trailing slashes are ignored when comparing.
 */
export function pathContainsDir(
	pathEnv: string | undefined,
	binDir: string,
	delimiter: string
): boolean {
	if (!pathEnv) {
		return false;
	}
	const normalize = (p: string) => p.trim().replace(/[\\/]+$/, '');
	const target = normalize(binDir);
	return pathEnv.split(delimiter).some((entry) => normalize(entry) === target);
}
