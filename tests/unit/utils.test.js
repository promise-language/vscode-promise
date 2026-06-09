const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const {
	parseEpochFromToml,
	parseEpochString,
	getPromiseHome,
	fileExists,
	findCompilerInHome,
	buildTaskArgs,
	verifyCompiler
} = require('../../out/utils');

// ---------------------------------------------------------------------------
// parseEpochString — regex tests against raw TOML content
// ---------------------------------------------------------------------------

describe('parseEpochString', () => {
	it('parses epoch from [module] section', () => {
		const toml = `[module]\nname = "math"\nepoch = "2026.3"\n`;
		assert.equal(parseEpochString(toml), '2026.3');
	});

	it('parses epoch from [catalog] section', () => {
		const toml = `[catalog]\nepoch = "2026.3"\n\n[modules.std]\ndescription = "Standard library"\n`;
		assert.equal(parseEpochString(toml), '2026.3');
	});

	it('handles spaces around equals sign', () => {
		assert.equal(parseEpochString('epoch  =  "2025.1"'), '2025.1');
	});

	it('handles tab indentation', () => {
		assert.equal(parseEpochString('\tepoch = "2026.3"'), '2026.3');
	});

	it('handles leading spaces', () => {
		assert.equal(parseEpochString('  epoch = "2026.3"'), '2026.3');
	});

	it('returns null when no epoch field', () => {
		const toml = `[module]\nname = "math"\n`;
		assert.equal(parseEpochString(toml), null);
	});

	it('returns null for empty string', () => {
		assert.equal(parseEpochString(''), null);
	});

	it('ignores commented-out epoch', () => {
		const toml = `[module]\n# epoch = "2026.3"\nname = "math"\n`;
		assert.equal(parseEpochString(toml), null);
	});

	it('returns first epoch when multiple present', () => {
		const toml = `epoch = "2025.1"\nepoch = "2026.3"\n`;
		assert.equal(parseEpochString(toml), '2025.1');
	});

	it('handles epoch with dot-separated segments', () => {
		assert.equal(parseEpochString('epoch = "2026.3.1"'), '2026.3.1');
	});

	it('does not match epoch without quotes', () => {
		assert.equal(parseEpochString('epoch = 2026.3'), null);
	});

	it('does not match epoch in a comment after code', () => {
		// epoch = "..." must be the value, not in a trailing comment
		const toml = `name = "foo" # epoch = "2026.3"\n`;
		assert.equal(parseEpochString(toml), null);
	});

	it('does not match epoch_version or other prefixed keys', () => {
		// regex requires \s*= after "epoch", so "epoch_version" won't match
		assert.equal(parseEpochString('epoch_version = "2026.3"\n'), null);
	});
});

// ---------------------------------------------------------------------------
// parseEpochFromToml — file-based tests
// ---------------------------------------------------------------------------

describe('parseEpochFromToml', () => {
	let tmpDir;

	before(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promise-test-'));
	});

	after(() => {
		fs.rmSync(tmpDir, { recursive: true });
	});

	it('reads epoch from a real TOML file', () => {
		const tomlPath = path.join(tmpDir, 'promise.toml');
		fs.writeFileSync(tomlPath, '[module]\nname = "test"\nepoch = "2026.3"\n');
		assert.equal(parseEpochFromToml(tomlPath), '2026.3');
	});

	it('returns null for nonexistent file', () => {
		assert.equal(parseEpochFromToml(path.join(tmpDir, 'nonexistent.toml')), null);
	});

	it('returns null for file without epoch', () => {
		const tomlPath = path.join(tmpDir, 'no-epoch.toml');
		fs.writeFileSync(tomlPath, '[module]\nname = "test"\n');
		assert.equal(parseEpochFromToml(tomlPath), null);
	});

	it('returns null for empty file', () => {
		const tomlPath = path.join(tmpDir, 'empty.toml');
		fs.writeFileSync(tomlPath, '');
		assert.equal(parseEpochFromToml(tomlPath), null);
	});
});

// ---------------------------------------------------------------------------
// fileExists
// ---------------------------------------------------------------------------

describe('fileExists', () => {
	let tmpDir;

	before(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promise-test-'));
	});

	after(() => {
		fs.rmSync(tmpDir, { recursive: true });
	});

	it('returns true for an existing file', () => {
		const filePath = path.join(tmpDir, 'exists.txt');
		fs.writeFileSync(filePath, 'hello');
		assert.equal(fileExists(filePath), true);
	});

	it('returns false for a nonexistent path', () => {
		assert.equal(fileExists(path.join(tmpDir, 'nope')), false);
	});

	it('returns false for a directory', () => {
		assert.equal(fileExists(tmpDir), false);
	});
});

// ---------------------------------------------------------------------------
// getPromiseHome
// ---------------------------------------------------------------------------

describe('getPromiseHome', () => {
	const origHome = process.env['PROMISE_HOME'];

	after(() => {
		if (origHome === undefined) {
			delete process.env['PROMISE_HOME'];
		} else {
			process.env['PROMISE_HOME'] = origHome;
		}
	});

	it('returns PROMISE_HOME when set', () => {
		process.env['PROMISE_HOME'] = '/custom/promise';
		assert.equal(getPromiseHome(), '/custom/promise');
	});

	it('returns ~/.promise when PROMISE_HOME is not set', () => {
		delete process.env['PROMISE_HOME'];
		const home = process.env['HOME'] || process.env['USERPROFILE'] || '';
		assert.equal(getPromiseHome(), path.join(home, '.promise'));
	});
});

// ---------------------------------------------------------------------------
// findCompilerInHome
// ---------------------------------------------------------------------------

describe('findCompilerInHome', () => {
	let tmpDir;

	before(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'promise-home-'));
		fs.mkdirSync(path.join(tmpDir, 'bin'));
	});

	after(() => {
		fs.rmSync(tmpDir, { recursive: true });
	});

	it('returns null when bin dir is empty', () => {
		const emptyHome = fs.mkdtempSync(path.join(os.tmpdir(), 'promise-empty-'));
		fs.mkdirSync(path.join(emptyHome, 'bin'));
		assert.equal(findCompilerInHome(emptyHome), null);
		fs.rmSync(emptyHome, { recursive: true });
	});

	it('returns null when bin dir does not exist', () => {
		const noHome = path.join(os.tmpdir(), 'promise-nobin-' + Date.now());
		assert.equal(findCompilerInHome(noHome), null);
	});

	it('returns the launcher stub when it exists', () => {
		const binPath = path.join(tmpDir, 'bin', 'promise');
		fs.writeFileSync(binPath, '#!/bin/sh\n');
		assert.equal(findCompilerInHome(tmpDir), binPath);
	});

	it('ignores epoch-specific binaries (stub is always used)', () => {
		// An epoch-specific binary must never be resolved directly.
		fs.writeFileSync(path.join(tmpDir, 'bin', 'promise-2026.3'), '#!/bin/sh\n');
		const result = findCompilerInHome(tmpDir);
		assert.ok(result.endsWith(path.join('bin', 'promise')));
	});
});

// ---------------------------------------------------------------------------
// buildTaskArgs
// ---------------------------------------------------------------------------

describe('buildTaskArgs', () => {
	it('build task', () => {
		const { args, label } = buildTaskArgs('build', '60s', 0);
		assert.deepEqual(args, ['build', '${file}']);
		assert.equal(label, 'promise: build');
	});

	it('run task', () => {
		const { args, label } = buildTaskArgs('run', '60s', 0);
		assert.deepEqual(args, ['run', '${file}']);
		assert.equal(label, 'promise: run');
	});

	it('check task', () => {
		const { args, label } = buildTaskArgs('check', '60s', 0);
		assert.deepEqual(args, ['check', '${file}']);
		assert.equal(label, 'promise: check');
	});

	it('clean task', () => {
		const { args, label } = buildTaskArgs('clean', '60s', 0);
		assert.deepEqual(args, ['clean']);
		assert.equal(label, 'promise: clean');
	});

	it('test file with default settings', () => {
		const { args, label } = buildTaskArgs('test file', '60s', 0);
		assert.deepEqual(args, ['test', '-timeout', '60s', '${file}']);
		assert.equal(label, 'promise: test file');
	});

	it('test file with custom timeout', () => {
		const { args } = buildTaskArgs('test file', '30s', 0);
		assert.deepEqual(args, ['test', '-timeout', '30s', '${file}']);
	});

	it('test file with parallelism', () => {
		const { args } = buildTaskArgs('test file', '60s', 4);
		assert.deepEqual(args, ['test', '-timeout', '60s', '-parallel', '4', '${file}']);
	});

	it('test directory with default settings', () => {
		const { args, label } = buildTaskArgs('test directory', '60s', 0);
		assert.deepEqual(args, ['test', '-timeout', '60s', '${workspaceFolder}/tests/...']);
		assert.equal(label, 'promise: test directory');
	});

	it('test directory with parallelism', () => {
		const { args } = buildTaskArgs('test directory', '2m', 8);
		assert.deepEqual(args, ['test', '-timeout', '2m', '-parallel', '8', '${workspaceFolder}/tests/...']);
	});

	it('unknown task falls through to default', () => {
		const { args, label } = buildTaskArgs('custom', '60s', 0);
		assert.deepEqual(args, ['custom']);
		assert.equal(label, 'promise: custom');
	});

	it('parallelism 0 does not add -parallel flag', () => {
		const { args } = buildTaskArgs('test file', '60s', 0);
		assert.ok(!args.includes('-parallel'));
	});

	it('negative parallelism does not add -parallel flag', () => {
		const { args } = buildTaskArgs('test file', '60s', -1);
		assert.ok(!args.includes('-parallel'));
	});
});

// ---------------------------------------------------------------------------
// verifyCompiler
// ---------------------------------------------------------------------------

describe('verifyCompiler', () => {
	it('returns true for a real executable', async () => {
		const result = await verifyCompiler('echo');
		assert.equal(result, true);
	});

	it('returns false for a nonexistent binary', async () => {
		const result = await verifyCompiler('/nonexistent/binary/path');
		assert.equal(result, false);
	});

	it('returns true for a binary that exits non-zero', async () => {
		// 'false' exits with code 1 but is still a valid binary
		const result = await verifyCompiler('false');
		assert.equal(result, true);
	});
});
