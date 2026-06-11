"use strict";

const fs = require("fs");
const path = require("path");

const { buildClaimStore } = require("./extract.js");
const { validateAgainstSchema } = require("./schema-validate.js");

const { writeJsonAtomic } = require("./io.js");

function loadSchema(name) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "schemas", name), "utf8"));
}

function parseFlags(rest, known) {
  const spec = Array.isArray(known)
    ? Object.fromEntries(known.map((name) => [name, "boolean"]))
    : known;
  const flags = {};
  const positional = [];
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const eq = arg.indexOf("=");
    const name = eq === -1 ? arg : arg.slice(0, eq);
    if (!(name in spec)) throw new Error(`unknown option "${name}"`);
    if (spec[name] === "boolean") {
      if (eq !== -1) throw new Error(`option "${name}" does not take a value`);
      flags[name.slice(2)] = true;
      continue;
    }
    if (eq !== -1) {
      flags[name.slice(2)] = arg.slice(eq + 1);
      continue;
    }
    const next = rest[index + 1];
    if (next === undefined || next.startsWith("--")) {
      throw new Error(`option "${name}" requires a value`);
    }
    flags[name.slice(2)] = next;
    index += 1;
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

function extract(rest) {
  const { flags, positional } = parseFlags(rest, { "--out": "value", "--json": "boolean" });
  if (positional.length !== 1) {
    throw new Error("usage: specdrift extract <spec-file-or-dir> [--out <file>] [--json]");
  }
  const targetAbs = path.resolve(process.cwd(), positional[0]);
  if (!fs.existsSync(targetAbs)) throw new Error(`spec source not found: ${positional[0]}`);
  const store = buildClaimStore(targetAbs, positional[0].replace(/\\/g, "/").replace(/\/+$/, ""));
  const schemaErrors = validateAgainstSchema(store, loadSchema("claims.schema.json"));
  if (schemaErrors.length > 0) {
    throw new Error(`internal error: generated claim store is schema-invalid: ${schemaErrors[0]}`);
  }
  const outRel = typeof flags.out === "string" && flags.out.length > 0
    ? flags.out
    : "specdrift.claims.json";
  const outAbs = path.resolve(process.cwd(), outRel);
  writeJsonAtomic(outAbs, store);
  const candidates = store.claims.filter((claim) => claim.contract_candidate).length;
  const boundaries = store.claims.filter((claim) => claim.claim_type === "boundary").length;
  const notes = [];
  if (store.claims.length === 0) notes.push("no claims extracted; spec may contain only headings");
  const output = {
    tool: "extract",
    status: store.claims.length === 0 ? "warn" : "pass",
    spec: positional[0],
    out: outRel,
    source_count: store.sources.length,
    claim_count: store.claims.length,
    candidate_count: candidates,
    boundary_count: boundaries,
    notes
  };
  if (flags.json) {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } else {
    process.stdout.write(
      `${output.status}: ${output.claim_count} claim(s), ${candidates} contract candidate(s), ` +
        `${boundaries} boundary claim(s) -> ${outRel}\n`
    );
    for (const note of notes) process.stdout.write(`note: ${note}\n`);
  }
  return 0;
}

const coverage = require("./coverage.js");

function emit(output, asJson, renderText) {
  if (asJson) process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  else renderText(output);
}

function loadStatusInputs(cwd, claimsRel, contractsRel, findings) {
  const store = coverage.loadJsonValidated(cwd, claimsRel, "claims.schema.json", "Claim store", findings);
  if (store) coverage.checkSourceFreshness(cwd, store, findings);
  let contracts = null;
  if (fs.existsSync(path.resolve(cwd, contractsRel))) {
    contracts = coverage.loadJsonValidated(
      cwd, contractsRel, "contracts.schema.json", "Contracts file", findings
    );
    if (store && contracts) coverage.checkContractIntegrity(store, contracts, findings);
  }
  return { store, contracts };
}

function status(rest) {
  const { flags, positional } = parseFlags(rest, {
    "--claims": "value",
    "--contracts": "value",
    "--json": "boolean"
  });
  if (positional.length > 0) throw new Error(`unexpected argument "${positional[0]}"`);
  const cwd = process.cwd();
  const claimsRel = flags.claims || coverage.DEFAULT_CLAIMS;
  const contractsRel = flags.contracts || coverage.DEFAULT_CONTRACTS;
  const findings = [];
  const { store, contracts } = loadStatusInputs(cwd, claimsRel, contractsRel, findings);
  const summary = store ? coverage.computeCoverage(store, contracts) : null;
  const output = {
    tool: "status",
    status: findings.length > 0 ? "fail" : summary.coverage_status === "confirmed" ? "pass" : "warn",
    claim_store: claimsRel,
    contracts_file: contractsRel,
    blocking_findings: findings,
    notes: findings.length === 0 && summary.coverage_status !== "confirmed"
      ? ["Review claims, then run: specdrift confirm --accept-current"]
      : [],
    ...(summary || {})
  };
  emit(output, flags.json, () => {
    process.stdout.write(`${output.status}: coverage ${output.coverage_status || "unknown"}\n`);
    for (const finding of findings) process.stdout.write(`blocking: ${finding}\n`);
    for (const note of output.notes) process.stdout.write(`note: ${note}\n`);
  });
  return findings.length > 0 ? 1 : 0;
}

function confirm(rest) {
  const { flags, positional } = parseFlags(rest, {
    "--claims": "value",
    "--out": "value",
    "--accept-current": "boolean",
    "--json": "boolean"
  });
  if (positional.length > 0) throw new Error(`unexpected argument "${positional[0]}"`);
  const cwd = process.cwd();
  const claimsRel = flags.claims || coverage.DEFAULT_CLAIMS;
  const contractsRel = flags.out || coverage.DEFAULT_CONTRACTS;
  if (!flags["accept-current"]) {
    throw new Error(
      "explicit confirmation required: review the claim store, then rerun with --accept-current"
    );
  }
  const findings = [];
  const store = coverage.loadJsonValidated(
    cwd, claimsRel, "claims.schema.json", "Claim store", findings
  );
  if (!store && findings.some((f) => f.includes("not found"))) {
    throw new Error(`claim store not found: ${claimsRel} — run "specdrift extract" first`);
  }
  if (store) coverage.checkSourceFreshness(cwd, store, findings);
  if (findings.length > 0) throw new Error(findings[0]);
  const contracts = coverage.buildContracts(store, claimsRel);
  const confirmedIds = new Set(contracts.contracts.map((contract) => contract.claim_id));
  const updatedStore = {
    ...store,
    claims: store.claims.map((claim) => ({
      ...claim,
      binding_status: confirmedIds.has(claim.claim_id) ? "confirmed_contract" : claim.binding_status
    }))
  };
  const contractErrors = validateAgainstSchema(contracts, loadSchema("contracts.schema.json"));
  const claimErrors = validateAgainstSchema(updatedStore, loadSchema("claims.schema.json"));
  if (contractErrors.length > 0 || claimErrors.length > 0) {
    throw new Error(`internal error: confirmation artifacts schema-invalid: ${
      (contractErrors[0] || claimErrors[0])
    }`);
  }
  writeJsonAtomic(path.resolve(cwd, contractsRel), contracts);
  writeJsonAtomic(path.resolve(cwd, claimsRel), updatedStore);
  const output = {
    tool: "confirm",
    status: "pass",
    mode: "accept_current",
    claim_store: claimsRel,
    contracts_file: contractsRel,
    confirmed_count: contracts.contracts.length,
    blocking_findings: [],
    notes: ["Confirmed contracts written; spec sources were not modified."]
  };
  emit(output, flags.json, () => {
    process.stdout.write(`pass: ${output.confirmed_count} contract(s) confirmed -> ${contractsRel}\n`);
  });
  return 0;
}

const verdictsLib = require("./verdicts.js");

function verdictRecord(rest) {
  const { flags, positional } = parseFlags(rest, {
    "--evidence": "value",
    "--reason": "value",
    "--approved-by": "value",
    "--claims": "value",
    "--verdicts": "value",
    "--overwrite": "boolean",
    "--json": "boolean"
  });
  if (positional.length !== 2) {
    throw new Error(
      "usage: specdrift verdict record <claim_id> <covered|missing|distorted|out_of_scope|" +
        "accepted_deviation> [--evidence <file[:line]>] [--reason <text>] [--approved-by <name>]"
    );
  }
  const cwd = process.cwd();
  const { file, entry } = verdictsLib.recordVerdict(cwd, {
    claimId: positional[0],
    verdict: positional[1],
    evidence: flags.evidence,
    reason: flags.reason,
    approvedBy: flags["approved-by"],
    overwrite: Boolean(flags.overwrite),
    claimsRel: flags.claims || coverage.DEFAULT_CLAIMS,
    verdictsRel: flags.verdicts || verdictsLib.DEFAULT_VERDICTS
  });
  const verdictsRel = flags.verdicts || verdictsLib.DEFAULT_VERDICTS;
  writeJsonAtomic(path.resolve(cwd, verdictsRel), file);
  const output = { tool: "verdict record", status: "pass", recorded: entry, verdicts_file: verdictsRel };
  emit(output, flags.json, () => {
    process.stdout.write(`pass: ${entry.claim_id} -> ${entry.verdict}\n`);
  });
  return 0;
}

function verdictAddition(rest) {
  const { flags, positional } = parseFlags(rest, {
    "--evidence": "value",
    "--note": "value",
    "--claims": "value",
    "--verdicts": "value",
    "--json": "boolean"
  });
  if (positional.length > 0) throw new Error(`unexpected argument "${positional[0]}"`);
  const cwd = process.cwd();
  const verdictsRel = flags.verdicts || verdictsLib.DEFAULT_VERDICTS;
  const { file } = verdictsLib.recordAddition(cwd, {
    evidence: flags.evidence,
    note: flags.note,
    claimsRel: flags.claims || coverage.DEFAULT_CLAIMS,
    verdictsRel
  });
  writeJsonAtomic(path.resolve(cwd, verdictsRel), file);
  const output = {
    tool: "verdict addition",
    status: "pass",
    addition_count: file.additions.length,
    verdicts_file: verdictsRel
  };
  emit(output, flags.json, () => {
    process.stdout.write(`pass: out-of-scope addition recorded (${file.additions.length} total)\n`);
  });
  return 0;
}

function report(rest) {
  const { flags, positional } = parseFlags(rest, {
    "--claims": "value",
    "--verdicts": "value",
    "--out": "value",
    "--strict": "boolean",
    "--json": "boolean"
  });
  if (positional.length > 0) throw new Error(`unexpected argument "${positional[0]}"`);
  const cwd = process.cwd();
  const claimsRel = flags.claims || coverage.DEFAULT_CLAIMS;
  const verdictsRel = flags.verdicts || verdictsLib.DEFAULT_VERDICTS;
  const { findings, report: body } = verdictsLib.buildReport(cwd, claimsRel, verdictsRel);
  const driftCount = body ? body.totals.missing + body.totals.distorted : 0;
  const output = {
    tool: "report",
    status: findings.length > 0 ? "fail" : driftCount > 0 ? "warn" : "pass",
    generated_at: new Date().toISOString(),
    claim_store: claimsRel,
    verdicts_file: verdictsRel,
    strict: Boolean(flags.strict),
    blocking_findings: findings,
    ...(body || {})
  };
  if (typeof flags.out === "string" && flags.out.length > 0) {
    writeJsonAtomic(path.resolve(cwd, flags.out), output);
  }
  emit(output, flags.json, () => {
    if (body) {
      process.stdout.write(
        `${output.status}: report ${body.report_status}, coverage ${body.coverage_percent}%, ` +
          `${body.totals.missing} missing, ${body.totals.distorted} distorted, ` +
          `${body.totals.waived} waived, ${body.additions.length} addition(s)\n`
      );
      for (const id of body.unverdicted_claim_ids) {
        process.stdout.write(`unverdicted: ${id}\n`);
      }
    }
    for (const finding of findings) process.stdout.write(`blocking: ${finding}\n`);
  });
  if (findings.length > 0) return 1;
  if (flags.strict && (body.report_status !== "complete" || driftCount > 0)) return 1;
  return 0;
}

const gateLib = require("./gate.js");

function gate(rest) {
  const { flags, positional } = parseFlags(rest, {
    "--fail-on": "value",
    "--min-coverage": "value",
    "--max-uncovered": "value",
    "--changed": "value",
    "--claims": "value",
    "--verdicts": "value",
    "--out": "value",
    "--comment-out": "value",
    "--json": "boolean"
  });
  if (positional.length > 0) throw new Error(`unexpected argument "${positional[0]}"`);
  const cwd = process.cwd();
  const result = gateLib.runGate(cwd, {
    failOn: flags["fail-on"],
    minCoverage: flags["min-coverage"],
    maxUncovered: flags["max-uncovered"],
    changed: flags.changed,
    claimsRel: flags.claims,
    verdictsRel: flags.verdicts
  });
  const output = { tool: "gate", generated_at: new Date().toISOString(), ...result };
  if (typeof flags.out === "string" && flags.out.length > 0) {
    writeJsonAtomic(path.resolve(cwd, flags.out), output);
  }
  if (typeof flags["comment-out"] === "string" && flags["comment-out"].length > 0) {
    const abs = path.resolve(cwd, flags["comment-out"]);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, gateLib.buildComment(result), "utf8");
  }
  emit(output, flags.json, () => {
    process.stdout.write(`${result.status}: gate fail_on=${result.gate.fail_on}\n`);
    for (const finding of result.blocking_findings) process.stdout.write(`blocking: ${finding}\n`);
    for (const warning of result.warnings) process.stdout.write(`warning: ${warning}\n`);
  });
  return result.status === "pass" ? 0 : 1;
}

const commands = {
  "extract": {
    summary: "Extract source-anchored claims from a spec file or spec directory",
    run: extract
  },
  "status": {
    summary: "Report claim coverage, contract confirmation state and source staleness",
    run: status
  },
  "verdict record": {
    summary: "Record a per-claim verdict (covered/missing/distorted/out_of_scope/accepted_deviation)",
    run: verdictRecord
  },
  "verdict addition": {
    summary: "Record an out-of-scope addition (unrequested change) with evidence",
    run: verdictAddition
  },
  "report": {
    summary: "Build the drift report from claims and verdicts (--strict gates on drift)",
    run: report
  },
  "gate": {
    summary: "CI gate: fail on drift, low coverage or uncovered changes; emits a PR comment body",
    run: gate
  },
  "confirm": {
    summary: "Bind current contract candidates into confirmed contracts (--accept-current)",
    run: confirm
  },
  "schema check": {
    summary: "Validate that all JSON schemas in schemas/ parse and are structurally sound",
    run: schemaCheck
  }
};

module.exports = { commands, parseFlags };
