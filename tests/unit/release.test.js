const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
	SUBCOMMANDS,
	channelArgs,
	useEpochArgs,
	parseUpdateCheck,
	platformTokens,
	assetName,
	parseSha256Sums,
	epochFromTag,
	parseEpochSegments,
	compareEpochs,
	selectRelease,
	pathContainsDir,
} = require('../../out/release');

// ---------------------------------------------------------------------------
// platformTokens
// ---------------------------------------------------------------------------

describe('platformTokens', () => {
	it('maps darwin/arm64', () => {
		assert.deepEqual(platformTokens('darwin', 'arm64'), { os: 'darwin', arch: 'arm64', exe: false });
	});

	it('maps linux/x64 to amd64', () => {
		assert.deepEqual(platformTokens('linux', 'x64'), { os: 'linux', arch: 'amd64', exe: false });
	});

	it('maps win32 to windows with exe flag', () => {
		assert.deepEqual(platformTokens('win32', 'x64'), {
			os: 'windows',
			arch: 'amd64',
			exe: true,
		});
	});

	it('returns null for unsupported platform', () => {
		assert.equal(platformTokens('sunos', 'x64'), null);
	});

	it('returns null for unsupported arch', () => {
		assert.equal(platformTokens('linux', 'mips'), null);
	});
});

// ---------------------------------------------------------------------------
// assetName
// ---------------------------------------------------------------------------

describe('assetName', () => {
	it('full variant on darwin/arm64', () => {
		assert.equal(assetName('darwin', 'arm64', 'full'), 'promise-darwin-arm64-full.gz');
	});

	it('thin variant has no variant suffix', () => {
		assert.equal(assetName('linux', 'x64', 'thin'), 'promise-linux-amd64.gz');
	});

	it('windows full variant carries .exe before .gz', () => {
		assert.equal(assetName('win32', 'x64', 'full'), 'promise-windows-amd64-full.exe.gz');
	});

	it('returns null for unsupported platform', () => {
		assert.equal(assetName('aix', 'x64', 'full'), null);
	});
});

// ---------------------------------------------------------------------------
// parseSha256Sums
// ---------------------------------------------------------------------------

describe('parseSha256Sums', () => {
	const HASH_A = 'a'.repeat(64);
	const HASH_B = 'B'.repeat(64);

	it('parses two-space (text mode) format', () => {
		const sums = parseSha256Sums(`${HASH_A}  promise-linux-amd64-full.gz\n`);
		assert.equal(sums.get('promise-linux-amd64-full.gz'), HASH_A);
	});

	it('parses asterisk (binary mode) format and lowercases the hash', () => {
		const sums = parseSha256Sums(`${HASH_B} *promise-windows-amd64-full.exe.gz\n`);
		assert.equal(sums.get('promise-windows-amd64-full.exe.gz'), 'b'.repeat(64));
	});

	it('ignores blank lines and malformed entries', () => {
		const sums = parseSha256Sums(`\nnot-a-hash file\n${HASH_A}  good.gz\n`);
		assert.equal(sums.size, 1);
		assert.equal(sums.get('good.gz'), HASH_A);
	});
});

// ---------------------------------------------------------------------------
// epoch parsing & comparison
// ---------------------------------------------------------------------------

describe('epochFromTag', () => {
	it('strips the epoch- prefix', () => {
		assert.equal(epochFromTag('epoch-2026.3'), '2026.3');
	});
	it('returns null for non-epoch tags', () => {
		assert.equal(epochFromTag('v1.0.0'), null);
	});
	it('handles epoch-next', () => {
		assert.equal(epochFromTag('epoch-next'), 'next');
	});
});

describe('parseEpochSegments', () => {
	it('parses dotted segments', () => {
		assert.deepEqual(parseEpochSegments('2026.3.1'), [2026, 3, 1]);
	});
	it('returns null for non-numeric (e.g. "next")', () => {
		assert.equal(parseEpochSegments('next'), null);
	});
});

describe('compareEpochs', () => {
	it('orders by major then minor', () => {
		assert.ok(compareEpochs('2026.3', '2026.1') > 0);
		assert.ok(compareEpochs('2025.9', '2026.0') < 0);
		assert.equal(compareEpochs('2026.3', '2026.3'), 0);
	});
	it('treats missing trailing segments as zero', () => {
		assert.equal(compareEpochs('2026.0', '2026'), 0);
		assert.ok(compareEpochs('2026.0.1', '2026.0') > 0);
	});
	it('sorts unparseable epochs lowest', () => {
		assert.ok(compareEpochs('next', '2026.0') < 0);
		assert.ok(compareEpochs('2026.0', 'next') > 0);
	});
});

// ---------------------------------------------------------------------------
// selectRelease
// ---------------------------------------------------------------------------

describe('selectRelease', () => {
	const rel = (tag, opts = {}) => ({
		tag_name: tag,
		prerelease: opts.prerelease ?? false,
		draft: opts.draft ?? false,
		published_at: opts.published_at ?? '',
		assets: [],
	});

	const releases = [
		rel('epoch-next', { prerelease: true }),
		rel('epoch-2026.1'),
		rel('epoch-2026.3'),
		rel('epoch-2026.2'),
		rel('epoch-2027.0', { draft: true }),
	];

	it('stable picks the highest non-prerelease epoch', () => {
		assert.equal(selectRelease(releases, 'stable').tag_name, 'epoch-2026.3');
	});

	it('stable excludes drafts', () => {
		// epoch-2027.0 is a draft and must not win
		assert.notEqual(selectRelease(releases, 'stable').tag_name, 'epoch-2027.0');
	});

	it('stable excludes epoch-next', () => {
		const onlyNext = [rel('epoch-next', { prerelease: true })];
		assert.equal(selectRelease(onlyNext, 'stable'), null);
	});

	it('next picks the epoch-next prerelease', () => {
		assert.equal(selectRelease(releases, 'next').tag_name, 'epoch-next');
	});

	it('next returns null when no epoch-next exists', () => {
		assert.equal(selectRelease([rel('epoch-2026.3')], 'next'), null);
	});

	it('returns null for stable when there are no stable releases', () => {
		assert.equal(selectRelease([], 'stable'), null);
	});
});

// ---------------------------------------------------------------------------
// CLI arg vectors
// ---------------------------------------------------------------------------

describe('CLI arg vectors', () => {
	it('install subcommand', () => {
		assert.deepEqual([...SUBCOMMANDS.install], ['install']);
	});
	it('check subcommand requests JSON', () => {
		assert.deepEqual([...SUBCOMMANDS.checkJson], ['update', 'check', '--json']);
	});
	it('update subcommand', () => {
		assert.deepEqual([...SUBCOMMANDS.update], ['update']);
	});
	it('channelArgs sets and follows a channel', () => {
		assert.deepEqual(channelArgs('next'), ['update', 'channel', 'next']);
		assert.deepEqual(channelArgs('stable'), ['update', 'channel', 'stable']);
	});
	it('useEpochArgs activates an epoch', () => {
		assert.deepEqual(useEpochArgs('2026.10'), ['use', '2026.10']);
	});
});

// ---------------------------------------------------------------------------
// parseUpdateCheck
// ---------------------------------------------------------------------------

describe('parseUpdateCheck', () => {
	it('parses a stable update-available payload', () => {
		const json = JSON.stringify({
			channel: 'stable',
			active: '2026.9',
			latest: '2026.10',
			updateAvailable: true,
			localBuild: '',
			remoteBuild: '',
		});
		const r = parseUpdateCheck(json);
		assert.equal(r.channel, 'stable');
		assert.equal(r.active, '2026.9');
		assert.equal(r.latest, '2026.10');
		assert.equal(r.updateAvailable, true);
	});

	it('parses an up-to-date payload', () => {
		const r = parseUpdateCheck(JSON.stringify({
			channel: 'stable',
			active: '2026.10',
			latest: '2026.10',
			updateAvailable: false,
		}));
		assert.equal(r.updateAvailable, false);
		assert.equal(r.localBuild, undefined);
	});

	it('parses next-channel build ids', () => {
		const r = parseUpdateCheck(JSON.stringify({
			channel: 'next',
			active: 'next',
			latest: 'next',
			updateAvailable: true,
			localBuild: 'abc123',
			remoteBuild: 'def456',
		}));
		assert.equal(r.channel, 'next');
		assert.equal(r.localBuild, 'abc123');
		assert.equal(r.remoteBuild, 'def456');
	});

	it('throws when updateAvailable is missing', () => {
		assert.throws(() => parseUpdateCheck(JSON.stringify({ channel: 'stable', active: '2026.9' })));
	});

	it('throws on invalid JSON', () => {
		assert.throws(() => parseUpdateCheck('not json'));
	});
});

// ---------------------------------------------------------------------------
// pathContainsDir
// ---------------------------------------------------------------------------

describe('pathContainsDir', () => {
	it('detects an exact entry', () => {
		assert.equal(pathContainsDir('/usr/bin:/home/x/.promise/bin', '/home/x/.promise/bin', ':'), true);
	});
	it('ignores trailing slashes', () => {
		assert.equal(pathContainsDir('/home/x/.promise/bin/', '/home/x/.promise/bin', ':'), true);
	});
	it('returns false when absent', () => {
		assert.equal(pathContainsDir('/usr/bin:/bin', '/home/x/.promise/bin', ':'), false);
	});
	it('returns false for empty/undefined PATH', () => {
		assert.equal(pathContainsDir(undefined, '/x/bin', ':'), false);
		assert.equal(pathContainsDir('', '/x/bin', ':'), false);
	});
	it('uses the provided delimiter (Windows ;)', () => {
		assert.equal(pathContainsDir('C:\\bin;C:\\Users\\x\\.promise\\bin', 'C:\\Users\\x\\.promise\\bin', ';'), true);
	});
});
