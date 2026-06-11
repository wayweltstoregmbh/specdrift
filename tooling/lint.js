"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SCAN_DIRS = ["bin", "lib", "tooling", "tests"];
const MAX_LINE_LENGTH = 120;

function listJsFiles(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJsFiles(rel));
    else if (entry.name.endsWith(".js")) out.push(rel);
  }
  return out;
}

function lintFile(rel) {
  const findings = [];
  const text = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const lines = text.split(/\r?\n/);
  const firstCode = lines[0].startsWith("#!") ? lines[1] : lines[0];
  if (firstCode !== '"use strict";') {
    findings.push(`${rel}:1 missing "use strict"; as first statement`);
  }
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/[ \t]+$/.test(line)) findings.push(`${rel}:${i + 1} trailing whitespace`);
    if (line.includes("\t")) findings.push(`${rel}:${i + 1} tab character (use spaces)`);
    if (line.length > MAX_LINE_LENGTH) findings.push(`${rel}:${i + 1} line exceeds ${MAX_LINE_LENGTH} chars`);
  }
  return findings;
}

function main() {
  const files = SCAN_DIRS.flatMap(listJsFiles);
  const findings = files.flatMap(lintFile);
  for (const finding of findings) process.stderr.write(`lint: ${finding}\n`);
  process.stdout.write(`lint: ${files.length} file(s) checked, ${findings.length} finding(s)\n`);
  return findings.length === 0 ? 0 : 1;
}

process.exitCode = main();
