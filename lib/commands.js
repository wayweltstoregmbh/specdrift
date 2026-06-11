"use strict";

const fs = require("fs");
const path = require("path");

function parseFlags(rest, known) {
  const flags = {};
  const positional = [];
  for (const arg of rest) {
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const eq = arg.indexOf("=");
    const name = eq === -1 ? arg : arg.slice(0, eq);
    if (!known.includes(name)) throw new Error(`unknown option "${name}"`);
    flags[name.slice(2)] = eq === -1 ? true : arg.slice(eq + 1);
  }
  return { flags, positional };
}

function schemaCheck(rest) {
  const { flags, positional } = parseFlags(rest, ["--json"]);
  if (positional.length > 0) throw new Error(`unexpected argument "${positional[0]}"`);
  const dir = path.resolve(__dirname, "..", "schemas");
  const files = fs.readdirSync(dir).filter((file) => file.endsWith(".json")).sort();
  const results = [];
  let failed = 0;
  for (const file of files) {
    let status = "pass";
    let message = "";
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
      if (typeof data !== "object" || data === null || Array.isArray(data)) {
        status = "fail";
        message = "schema root must be a JSON object";
      } else if (typeof data.$schema !== "string") {
        status = "fail";
        message = "missing $schema declaration";
      } else if (!data.type && !data.properties && !data.oneOf && !data.anyOf && !data.allOf) {
        status = "fail";
        message = "missing type/properties/oneOf/anyOf/allOf";
      }
    } catch (err) {
      status = "fail";
      message = err.message;
    }
    if (status === "fail") failed += 1;
    results.push({ file, status, message });
  }
  const output = {
    tool: "schema check",
    status: failed === 0 ? "pass" : "fail",
    checked: results.length,
    failed,
    results
  };
  if (flags.json) {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } else {
    for (const result of results) {
      const suffix = result.message ? ` — ${result.message}` : "";
      process.stdout.write(`${result.status.toUpperCase().padEnd(5)} ${result.file}${suffix}\n`);
    }
    process.stdout.write(`${output.status}: ${results.length} schema(s), ${failed} failed\n`);
  }
  return failed === 0 ? 0 : 1;
}

const commands = {
  "schema check": {
    summary: "Validate that all JSON schemas in schemas/ parse and are structurally sound",
    run: schemaCheck
  }
};

module.exports = { commands, parseFlags };
