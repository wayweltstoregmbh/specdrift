"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const BIN = path.join(ROOT, "bin", "specdrift.js");

function run(args) {
  return spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8", cwd: ROOT });
}

test("M0-P02: --version prints semver and exits 0", () => {
  const result = run(["--version"]);
  assert.strictEqual(result.status, 0);
  assert.match(result.stdout.trim(), /^\d+\.\d+\.\d+$/);
});

test("M0-P03: --help lists all registered commands with summaries and exits 0", () => {
  const result = run(["--help"]);
  assert.strictEqual(result.status, 0);
  assert.match(result.stdout, /Usage: specdrift <command>/);
  assert.match(result.stdout, /schema check\s+\S/);
  assert.match(result.stdout, /--version/);
});

test("M0-P04: lint runs clean over the repository", () => {
  const result = spawnSync(process.execPath, [path.join(ROOT, "tooling", "lint.js")], {
    encoding: "utf8",
    cwd: ROOT
  });
  assert.strictEqual(result.status, 0, `lint findings:\n${result.stderr}`);
  assert.match(result.stdout, /0 finding\(s\)/);
});

test("M0-P05: schema check passes and reports every schema file", () => {
  const result = run(["schema", "check", "--json"]);
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  const output = JSON.parse(result.stdout);
  assert.strictEqual(output.tool, "schema check");
  assert.strictEqual(output.status, "pass");
  assert.ok(output.checked >= 1, "at least one schema must exist and be checked");
  assert.strictEqual(output.failed, 0);
});

test("M0-N01: unknown command exits non-zero with help hint and no stacktrace", () => {
  const result = run(["nonsense"]);
  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /unknown command "nonsense"/);
  assert.match(result.stderr, /--help/);
  assert.ok(!/\bat .+:\d+:\d+/.test(result.stderr), "stderr must not contain a stacktrace");
});

test("M0-N02: unknown flag on valid command exits non-zero and names the flag", () => {
  const result = run(["schema", "check", "--bogus"]);
  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr, /unknown option "--bogus"/);
  assert.ok(!/\bat .+:\d+:\d+/.test(result.stderr), "stderr must not contain a stacktrace");
});
