const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// Load the problem matcher regex from package.json
const pkg = JSON.parse(fs.readFileSync(
	path.join(__dirname, '../../package.json'), 'utf-8'
));
const matcherConfig = pkg.contributes.problemMatchers[0];
const pattern = new RegExp(matcherConfig.pattern.regexp);

// ---------------------------------------------------------------------------
// Problem matcher regex — must match real compiler error output
// ---------------------------------------------------------------------------

describe('problem matcher regex', () => {

	describe('should match compiler errors', () => {
		it('simple error with relative path', () => {
			const line = 'broken.pr:5:3: type Foo has no field \'bar\'';
			const m = line.match(pattern);
			assert.ok(m, 'regex should match');
			assert.equal(m[1], 'broken.pr');        // file
			assert.equal(m[2], '5');                 // line
			assert.equal(m[3], '3');                 // column
			assert.equal(m[4], 'type Foo has no field \'bar\''); // message
		});

		it('error with nested relative path', () => {
			const line = 'tests/e2e/basics.pr:10:0: undeclared variable \'x\'';
			const m = line.match(pattern);
			assert.ok(m);
			assert.equal(m[1], 'tests/e2e/basics.pr');
			assert.equal(m[2], '10');
			assert.equal(m[3], '0');
			assert.equal(m[4], 'undeclared variable \'x\'');
		});

		it('error with absolute path', () => {
			const line = '/home/user/prog/project/src/main.pr:42:15: type mismatch';
			const m = line.match(pattern);
			assert.ok(m);
			assert.equal(m[1], '/home/user/prog/project/src/main.pr');
			assert.equal(m[2], '42');
			assert.equal(m[3], '15');
			assert.equal(m[4], 'type mismatch');
		});

		it('error at column 0', () => {
			const line = 'file.pr:1:0: unexpected token';
			const m = line.match(pattern);
			assert.ok(m);
			assert.equal(m[3], '0');
		});

		it('error with long message containing colons', () => {
			const line = 'file.pr:3:7: expected type: int, got: string';
			const m = line.match(pattern);
			assert.ok(m);
			assert.equal(m[4], 'expected type: int, got: string');
		});

		it('error with high line number', () => {
			const line = 'large_file.pr:9999:42: overflow detected';
			const m = line.match(pattern);
			assert.ok(m);
			assert.equal(m[2], '9999');
			assert.equal(m[3], '42');
		});
	});

	describe('should NOT match non-error lines', () => {
		it('PASS line', () => {
			assert.equal('PASS (0.001s) test_add'.match(pattern), null);
		});

		it('FAIL line', () => {
			assert.equal('FAIL (0.003s) test_broken'.match(pattern), null);
		});

		it('blank line', () => {
			assert.equal(''.match(pattern), null);
		});

		it('summary line', () => {
			assert.equal('3 passed, 1 failed (0.423s)'.match(pattern), null);
		});

		it('panic context (indented)', () => {
			assert.equal('  panic: assertion failed: expected 3, got 4'.match(pattern), null);
		});

		it('file path without line:col (just filename)', () => {
			assert.equal('file.pr'.match(pattern), null);
		});

		it('test output with timing', () => {
			assert.equal('PASS (0.004s) e2e/basics.pr (3 tests)'.match(pattern), null);
		});
	});
});
