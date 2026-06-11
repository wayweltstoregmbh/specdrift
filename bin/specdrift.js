#!/usr/bin/env node
"use strict";

const { commands } = require("../lib/commands.js");
const pkg = require("../package.json");

function printHelp() {
  const lines = [
    `specdrift ${pkg.version} — spec-fidelity verification for AI coding agents`,
    "",
    "Usage: specdrift <command> [options]",
    "",
    "Commands:"
  ];
  for (const [name, def] of Object.entries(commands)) {
    lines.push(`  ${name.padEnd(26)}${def.summary}`);
  }
  lines.push("");
  lines.push("Global options:");
  lines.push("  --help                    Show this help");
  lines.push("  --version                 Print version");
  process.stdout.write(`${lines.join("\n")}\n`);
}

function main(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === "--help") {
    printHelp();
    return 0;
  }
  if (args[0] === "--version") {
    process.stdout.write(`${pkg.version}\n`);
    return 0;
  }
  let matched = null;
  for (const name of Object.keys(commands)) {
    const parts = name.split(" ");
    if (parts.every((part, index) => args[index] === part)) {
      if (!matched || name.length > matched.length) matched = name;
    }
  }
  if (!matched) {
    process.stderr.write(`specdrift: unknown command "${args.join(" ")}"\n`);
    process.stderr.write('Run "specdrift --help" for available commands.\n');
    return 1;
  }
  const rest = args.slice(matched.split(" ").length);
  if (rest.includes("--help")) {
    const def = commands[matched];
    process.stdout.write(`specdrift ${matched} — ${def.summary}\n`);
    process.stdout.write(`Usage: specdrift ${matched} ${def.usage || ""}\n`);
    return 0;
  }
  try {
    return commands[matched].run(rest);
  } catch (err) {
    process.stderr.write(`specdrift: ${err.message}\n`);
    return 1;
  }
}

process.exitCode = main(process.argv);
