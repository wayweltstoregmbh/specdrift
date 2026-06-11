"use strict";

const fs = require("fs");
const path = require("path");

const coverage = require("./coverage.js");
const { validateAgainstSchema } = require("./schema-validate.js");

const DEFAULT_VERDICTS = "specdrift.verdicts.json";
const VERDICT_TYPES = ["covered", "missing", "distorted", "out_of_scope", "accepted_deviation"];

function loadSchemaFile(name) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "schemas", name), "utf8"));
}

function emptyVerdictFile(claimsRel) {
  return {
    $schema: "https://specdrift.dev/schemas/verdicts.schema.json",
    schema_version: "1.0",
    tool: "specdrift verdict",
    claim_store: claimsRel,
    verdicts: [],
    additions: []
  };
}

function loadInputs(cwd, claimsRel, verdictsRel, findings) {
  const store = coverage.loadJsonValidated(
    cwd, claimsRel, "claims.schema.json", "Claim store", findings
  );
  if (store) coverage.checkSourceFreshness(cwd, store, findings);
  let verdictFile = null;
  if (fs.existsSync(path.resolve(cwd, verdictsRel))) {
    verdictFile = coverage.loadJsonValidated(
      cwd, verdictsRel, "verdicts.schema.json", "Verdicts file", findings
    );
  }
  return { store, verdictFile };
}

function parseEvidenceRef(cwd, raw) {
  const match = String(raw).match(/^(.*?)(?::(\d+))?$/);
  const file = match[1];
  const line = match[2] ? Number(match[2]) : null;
  const abs = path.resolve(cwd, file);
  const rootWithSep = `${path.resolve(cwd)}${path.sep}`;
  if (!abs.startsWith(rootWithSep)) {
    throw new Error(`evidence path escapes the project root: ${file}`);
  }
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    throw new Error(`evidence file not found: ${file}`);
  }
  return { file: file.replace(/\\/g, "/"), line };
}

function recordVerdict(cwd, options) {
  const findings = [];
  const { store, verdictFile } = loadInputs(cwd, options.claimsRel, options.verdictsRel, findings);
  if (findings.length > 0) throw new Error(findings[0]);
  const claim = store.claims.find((entry) => entry.claim_id === options.claimId);
  if (!claim) throw new Error(`unknown claim id: ${options.claimId}`);
  if (!VERDICT_TYPES.includes(options.verdict)) {
    throw new Error(`unknown verdict "${options.verdict}" (expected: ${VERDICT_TYPES.join(", ")})`);
  }
  if (options.verdict === "covered" && !options.evidence) {
    throw new Error('verdict "covered" requires --evidence <file[:line]>');
  }
  if (["distorted", "out_of_scope"].includes(options.verdict) && !options.reason) {
    throw new Error(`verdict "${options.verdict}" requires --reason`);
  }
  if (options.verdict === "accepted_deviation") {
    if (!options.reason) throw new Error('verdict "accepted_deviation" requires --reason');
    if (!options.approvedBy) throw new Error('verdict "accepted_deviation" requires --approved-by');
  }
  const file = verdictFile || emptyVerdictFile(options.claimsRel);
  const existing = file.verdicts.findIndex((entry) => entry.claim_id === options.claimId);
  if (existing !== -1 && !options.overwrite) {
    throw new Error(
      `a verdict for ${options.claimId} already exists; rerun with --overwrite to replace it`
    );
  }
  const entry = {
    claim_id: claim.claim_id,
    verdict: options.verdict,
    source_hash: claim.source_hash,
    evidence: options.evidence ? [parseEvidenceRef(cwd, options.evidence)] : [],
    reason: options.reason || "",
    approved_by: options.approvedBy || "",
    overwrote_previous: existing !== -1,
    recorded_at: new Date().toISOString()
  };
  if (existing !== -1) file.verdicts[existing] = entry;
  else file.verdicts.push(entry);
  file.verdicts.sort((a, b) => a.claim_id.localeCompare(b.claim_id));
  const errors = validateAgainstSchema(file, loadSchemaFile("verdicts.schema.json"));
  if (errors.length > 0) throw new Error(`internal error: verdicts file schema-invalid: ${errors[0]}`);
  return { file, entry };
}

function recordAddition(cwd, options) {
  const findings = [];
  const { store, verdictFile } = loadInputs(cwd, options.claimsRel, options.verdictsRel, findings);
  if (findings.length > 0) throw new Error(findings[0]);
  if (!store) throw new Error("claim store missing");
  if (!options.note) throw new Error("addition requires --note describing the unrequested change");
  const evidence = options.evidence ? parseEvidenceRef(cwd, options.evidence) : null;
  if (!evidence) throw new Error("addition requires --evidence <file[:line]>");
  const file = verdictFile || emptyVerdictFile(options.claimsRel);
  file.additions.push({
    evidence: [evidence],
    note: options.note,
    recorded_at: new Date().toISOString()
  });
  const errors = validateAgainstSchema(file, loadSchemaFile("verdicts.schema.json"));
  if (errors.length > 0) throw new Error(`internal error: verdicts file schema-invalid: ${errors[0]}`);
  return { file };
}

function claimSummary(claim) {
  return {
    claim_id: claim.claim_id,
    source_file: claim.source_file,
    source_line: claim.source_line_start,
    source_text: claim.source_text
  };
}

function buildReport(cwd, claimsRel, verdictsRel) {
  const findings = [];
  const { store, verdictFile } = loadInputs(cwd, claimsRel, verdictsRel, findings);
  let report = null;
  if (store && findings.length === 0) {
    const verdicts = verdictFile ? verdictFile.verdicts : [];
    const byClaim = new Map(verdicts.map((entry) => [entry.claim_id, entry]));
    for (const entry of verdicts) {
      const claim = store.claims.find((c) => c.claim_id === entry.claim_id);
      if (!claim) findings.push(`verdict references unknown claim: ${entry.claim_id}`);
      else if (claim.source_hash !== entry.source_hash) {
        findings.push(`verdict for ${entry.claim_id} is bound to a stale spec hash`);
      }
    }
    const required = store.claims.filter((claim) => claim.claim_type !== "boundary");
    const pick = (type) => required
      .filter((claim) => byClaim.get(claim.claim_id)?.verdict === type)
      .map((claim) => ({
        ...claimSummary(claim),
        reason: byClaim.get(claim.claim_id).reason,
        approved_by: byClaim.get(claim.claim_id).approved_by,
        evidence: byClaim.get(claim.claim_id).evidence
      }));
    const unverdicted = required
      .filter((claim) => !byClaim.has(claim.claim_id))
      .map((claim) => claim.claim_id);
    const covered = pick("covered");
    const missing = pick("missing");
    const distorted = pick("distorted");
    const outOfScope = pick("out_of_scope");
    const waived = pick("accepted_deviation");
    const accountedFor = covered.length + waived.length + outOfScope.length;
    report = {
      report_status: unverdicted.length === 0 && findings.length === 0 ? "complete" : "incomplete",
      totals: {
        required: required.length,
        covered: covered.length,
        missing: missing.length,
        distorted: distorted.length,
        out_of_scope: outOfScope.length,
        waived: waived.length,
        unverdicted: unverdicted.length
      },
      coverage_percent: required.length === 0
        ? 100
        : Math.round((accountedFor / required.length) * 1000) / 10,
      drift: { missing, distorted },
      waived,
      out_of_scope_claims: outOfScope,
      additions: verdictFile ? verdictFile.additions : [],
      unverdicted_claim_ids: unverdicted
    };
  }
  return { findings, report, store };
}

module.exports = {
  DEFAULT_VERDICTS,
  VERDICT_TYPES,
  recordVerdict,
  recordAddition,
  buildReport
};
