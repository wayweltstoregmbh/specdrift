#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const pkg = require("../package.json");
const { buildClaimStore } = require("../lib/extract.js");
const coverage = require("../lib/coverage.js");
const verdictsLib = require("../lib/verdicts.js");
const { validateAgainstSchema } = require("../lib/schema-validate.js");
const { writeJsonAtomic, resolveInRoot } = require("../lib/io.js");

const ROOT = process.cwd();

function relInRoot(rel, label) {
  return resolveInRoot(ROOT, rel, label);
}

function loadStoreOrThrow(claimsRel) {
  const findings = [];
  const store = coverage.loadJsonValidated(
    ROOT, claimsRel, "claims.schema.json", "Claim store", findings
  );
  if (store) coverage.checkSourceFreshness(ROOT, store, findings);
  if (findings.length > 0) {
    const message = findings.join("; ");
    if (message.includes("not found")) {
      throw new Error(`${message} — run the "extract_claims" tool first`);
    }
    throw new Error(message);
  }
  return store;
}

const TOOLS = {
  extract_claims: {
    description:
      "Extract source-anchored claims from a spec file or spec directory into a claim store.",
    inputSchema: {
      type: "object",
      required: ["spec_path"],
      additionalProperties: false,
      properties: {
        spec_path: { type: "string", minLength: 1 },
        out_path: { type: "string", minLength: 1 }
      }
    },
    run(args) {
      const specAbs = relInRoot(args.spec_path, "spec path");
      if (!fs.existsSync(specAbs)) throw new Error(`spec source not found: ${args.spec_path}`);
      const store = buildClaimStore(specAbs, args.spec_path.replace(/\\/g, "/"));
      const outRel = args.out_path || coverage.DEFAULT_CLAIMS;
      writeJsonAtomic(relInRoot(outRel, "output path"), store);
      return {
        out: outRel,
        source_count: store.sources.length,
        claim_count: store.claims.length,
        candidate_count: store.claims.filter((claim) => claim.contract_candidate).length,
        boundary_count: store.claims.filter((claim) => claim.claim_type === "boundary").length
      };
    }
  },
  get_claims: {
    description: "Return the current claim store (fails on stale or schema-invalid stores).",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        claims_path: { type: "string", minLength: 1 }
      }
    },
    run(args) {
      relInRoot(args.claims_path || coverage.DEFAULT_CLAIMS, "claims path");
      return loadStoreOrThrow(args.claims_path || coverage.DEFAULT_CLAIMS);
    }
  },
  check_coverage: {
    description: "Report claim coverage, contract confirmation state and source staleness.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        claims_path: { type: "string", minLength: 1 },
        contracts_path: { type: "string", minLength: 1 }
      }
    },
    run(args) {
      const claimsRel = args.claims_path || coverage.DEFAULT_CLAIMS;
      const contractsRel = args.contracts_path || coverage.DEFAULT_CONTRACTS;
      relInRoot(claimsRel, "claims path");
      relInRoot(contractsRel, "contracts path");
      const findings = [];
      const store = coverage.loadJsonValidated(
        ROOT, claimsRel, "claims.schema.json", "Claim store", findings
      );
      if (store) coverage.checkSourceFreshness(ROOT, store, findings);
      let contracts = null;
      if (fs.existsSync(path.resolve(ROOT, contractsRel))) {
        contracts = coverage.loadJsonValidated(
          ROOT, contractsRel, "contracts.schema.json", "Contracts file", findings
        );
        if (store && contracts) coverage.checkContractIntegrity(store, contracts, findings);
      }
      const summary = store && findings.length === 0 ? coverage.computeCoverage(store, contracts) : {};
      return {
        status: findings.length > 0 ? "fail" : "pass",
        blocking_findings: findings,
        ...summary
      };
    }
  },
  record_verdict: {
    description:
      "Record a per-claim verdict (covered/missing/distorted/out_of_scope/accepted_deviation). " +
      "covered requires evidence; accepted_deviation requires reason and approved_by.",
    inputSchema: {
      type: "object",
      required: ["claim_id", "verdict"],
      additionalProperties: false,
      properties: {
        claim_id: { type: "string", pattern: "^claim_\\d{3,}$" },
        verdict: {
          type: "string",
          enum: ["covered", "missing", "distorted", "out_of_scope", "accepted_deviation"]
        },
        evidence: { type: "string", minLength: 1 },
        reason: { type: "string" },
        approved_by: { type: "string" },
        overwrite: { type: "boolean" },
        claims_path: { type: "string", minLength: 1 },
        verdicts_path: { type: "string", minLength: 1 }
      }
    },
    run(args) {
      const claimsRel = args.claims_path || coverage.DEFAULT_CLAIMS;
      const verdictsRel = args.verdicts_path || verdictsLib.DEFAULT_VERDICTS;
      relInRoot(claimsRel, "claims path");
      relInRoot(verdictsRel, "verdicts path");
      loadStoreOrThrow(claimsRel);
      const { file, entry } = verdictsLib.recordVerdict(ROOT, {
        claimId: args.claim_id,
        verdict: args.verdict,
        evidence: args.evidence,
        reason: args.reason,
        approvedBy: args.approved_by,
        overwrite: Boolean(args.overwrite),
        claimsRel,
        verdictsRel
      });
      writeJsonAtomic(relInRoot(verdictsRel, "verdicts path"), file);
      return { recorded: entry, verdicts_file: verdictsRel };
    }
  },
  drift_report: {
    description:
      "Build the drift report from claims and verdicts: coverage, missing, distorted, waived, " +
      "additions and unverdicted claims.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        claims_path: { type: "string", minLength: 1 },
        verdicts_path: { type: "string", minLength: 1 }
      }
    },
    run(args) {
      const claimsRel = args.claims_path || coverage.DEFAULT_CLAIMS;
      const verdictsRel = args.verdicts_path || verdictsLib.DEFAULT_VERDICTS;
      relInRoot(claimsRel, "claims path");
      relInRoot(verdictsRel, "verdicts path");
      const { findings, report } = verdictsLib.buildReport(ROOT, claimsRel, verdictsRel);
      if (findings.length > 0) throw new Error(findings.join("; "));
      return report;
    }
  }
};

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function handleToolCall(msg) {
  const name = msg.params && msg.params.name;
  const args = (msg.params && msg.params.arguments) || {};
  const tool = TOOLS[name];
  if (!tool) {
    send({ jsonrpc: "2.0", id: msg.id, error: { code: -32602, message: `unknown tool: ${name}` } });
    return;
  }
  const argErrors = validateAgainstSchema(args, tool.inputSchema);
  if (argErrors.length > 0) {
    send({
      jsonrpc: "2.0",
      id: msg.id,
      result: {
        content: [{ type: "text", text: `invalid arguments: ${argErrors.join("; ")}` }],
        isError: true
      }
    });
    return;
  }
  try {
    const data = tool.run(args);
    send({
      jsonrpc: "2.0",
      id: msg.id,
      result: { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] }
    });
  } catch (err) {
    send({
      jsonrpc: "2.0",
      id: msg.id,
      result: { content: [{ type: "text", text: `error: ${err.message}` }], isError: true }
    });
  }
}

function handleLine(line) {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } });
    return;
  }
  if (msg.method === "initialize") {
    send({
      jsonrpc: "2.0",
      id: msg.id,
      result: {
        protocolVersion: (msg.params && msg.params.protocolVersion) || "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "specdrift", version: pkg.version }
      }
    });
    return;
  }
  if (msg.method === "notifications/initialized" || msg.method === "notifications/cancelled") return;
  if (msg.method === "ping") {
    send({ jsonrpc: "2.0", id: msg.id, result: {} });
    return;
  }
  if (msg.method === "tools/list") {
    send({
      jsonrpc: "2.0",
      id: msg.id,
      result: {
        tools: Object.entries(TOOLS).map(([name, tool]) => ({
          name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }))
      }
    });
    return;
  }
  if (msg.method === "tools/call") {
    handleToolCall(msg);
    return;
  }
  if (msg.id !== undefined) {
    send({
      jsonrpc: "2.0",
      id: msg.id,
      error: { code: -32601, message: `method not found: ${msg.method}` }
    });
  }
}

let buffer = "";
process.stdin.on("data", (chunk) => {
  buffer += chunk.toString("utf8");
  let index = buffer.indexOf("\n");
  while (index !== -1) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (line.length > 0) handleLine(line);
    index = buffer.indexOf("\n");
  }
});
process.stdin.on("end", () => process.exit(0));
