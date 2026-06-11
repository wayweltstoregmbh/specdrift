"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const files = fs
  .readdirSync(path.join(ROOT, "tests"))
  .filter((file) => file.endsWith(".test.js"))
  .sort()
  .map((file) => path.join("tests", file));

if (files.length === 0) {
  process.stderr.write("no test files found under tests/\n");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--test", ...files], {
  cwd: ROOT,
  stdio: "inherit"
});
process.exit(result.status === null ? 1 : result.status);
