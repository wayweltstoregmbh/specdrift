"use strict";

const fs = require("fs");
const path = require("path");

const { sha256, readSpecText } = require("./extract.js");
const { validateAgainstSchema } = require("./schema-validate.js");

const DEFAULT_CLAIMS = "specdrift.claims.json";
const DEFAULT_CONTRACTS = "specdrift.contracts.json";

const CONTRACT_TYPE_BY_CLAIM_TYPE = {
  security_must: "security",
  technical_must: "technical",
  forbidden: "constraint",
  data: "privacy",
  ui: "ux",
  acceptance: "acceptance",
  feature: "functional",
  context: "context"
};

function loadSchemaFile(name) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "schemas", name), "utf8"));
}

function loadJsonValidated(cwd, rel, schemaName, label, findings) {
  const abs = path.resolve(cwd, rel);
  if (!fs.existsSync(abs)) {
    findings.push(`${label} not found: ${rel}`);
    return null;
  }
  let data;
  try {
    data = JSON.parse(fs.readFileSync(abs, "utf8"));
  } catch (err) {
    findings.push(`${label} is not valid JSON: ${rel} (${err.message})`);
    return null;
  }
  const errors = validateAgainstSchema(data, loadSchemaFile(schemaName));
  if (errors.length > 0) {
    findings.push(`${label} is schema-invalid: ${rel} — ${errors[0]}`);
    return null;
  }
  return data;
}

function checkSourceFreshness(cwd, store, findings) {
  for (const source of store.sources) {
    const abs = path.resolve(cwd, source.file);
    if (!fs.existsSync(abs)) {
      findings.push(`spec source missing: ${source.file}`);
      continue;
    }
    let text;
    try {
      text = readSpecText(abs);
    } catch (err) {
      findings.push(`spec source unreadable: ${source.file} (${err.message})`);
      continue;
    }
    if (sha256(text) !== source.hash) {
      findings.push(`claim store is stale: ${source.file} changed since extraction (hash mismatch)`);
    }
  }
}

function isCritical(claim) {
  if (claim.claim_type === "boundary") return false;
  return claim.contract_candidate
    || ["must", "must_not", "acceptance"].includes(claim.strength)
    || ["security_must", "technical_must", "forbidden", "data", "acceptance"].includes(claim.claim_type);
}

function checkContractIntegrity(store, contracts, findings) {
  const claimsById = new Map(store.claims.map((claim) => [claim.claim_id, claim]));
  for (const contract of contracts.contracts) {
    const claim = claimsById.get(contract.claim_id);
    if (!claim) {
      findings.push(`contract integrity: ${contract.contract_id} references unknown ${contract.claim_id}`);
      continue;
    }
    if (contract.statement !== claim.source_text) {
      findings.push(
        `contract integrity: ${contract.contract_id} statement does not match claim source text`
      );
    }
    if (contract.source_hash !== claim.source_hash) {
      findings.push(`contract integrity: ${contract.contract_id} source hash does not match claim`);
    }
  }
}

function buildGates(store, contracts, unboundCritical, unconfirmed) {
  return [
    {
      gate_id: "source_anchors_present",
      status: store.claims.every(
        (claim) => claim.source_file && claim.source_hash && claim.source_line_start > 0
      ) ? "pass" : "fail"
    },
    {
      gate_id: "critical_claims_bound",
      status: unboundCritical.length === 0 ? "pass" : "fail"
    },
    {
      gate_id: "human_confirmation",
      status: contracts && unconfirmed.length === 0 ? "pass" : "warn"
    }
  ];
}

function computeCoverage(store, contracts) {
  const candidates = store.claims.filter((claim) => claim.contract_candidate);
  const critical = store.claims.filter(isCritical);
  const boundaries = store.claims.filter((claim) => claim.claim_type === "boundary");
  const confirmedIds = new Set((contracts ? contracts.contracts : []).map((c) => c.claim_id));
  const unboundCritical = critical
    .filter((claim) => !claim.contract_candidate)
    .map((claim) => claim.claim_id);
  const unconfirmed = candidates
    .filter((claim) => !confirmedIds.has(claim.claim_id))
    .map((claim) => claim.claim_id);
  let coverageStatus = "ready_for_confirmation";
  if (unboundCritical.length > 0) coverageStatus = "blocked";
  else if (contracts && unconfirmed.length === 0) coverageStatus = "confirmed";
  return {
    coverage_status: coverageStatus,
    claim_count: store.claims.length,
    critical_claim_count: critical.length,
    candidate_count: candidates.length,
    boundary_count: boundaries.length,
    confirmed_count: contracts ? contracts.contracts.length : 0,
    unbound_critical_claim_ids: unboundCritical,
    unconfirmed_candidate_claim_ids: unconfirmed,
    gates: buildGates(store, contracts, unboundCritical, unconfirmed)
  };
}

function buildContracts(store, claimsRel) {
  const confirmedAt = new Date().toISOString();
  const contracts = store.claims
    .filter((claim) => claim.contract_candidate)
    .map((claim) => ({
      contract_id: `contract_${claim.claim_id}`,
      claim_id: claim.claim_id,
      source_file: claim.source_file,
      source_hash: claim.source_hash,
      source_line_start: claim.source_line_start,
      source_line_end: claim.source_line_end,
      statement: claim.source_text,
      contract_type: CONTRACT_TYPE_BY_CLAIM_TYPE[claim.claim_type] || "functional",
      priority: claim.strength,
      required_mechanism: claim.claim_type === "technical_must"
        ? "preserve_named_mechanism"
        : "preserve_requirement",
      forbidden_substitutions: claim.strength === "must_not" ? [claim.source_text] : [],
      required_evidence: claim.evidence_candidates,
      status: "confirmed"
    }));
  return {
    $schema: "https://specdrift.dev/schemas/contracts.schema.json",
    schema_version: "1.0",
    tool: "specdrift confirm",
    confirmed_at: confirmedAt,
    claim_store: claimsRel,
    sources: store.sources,
    confirmation: {
      mode: "accept_current",
      confirmation_text: "Current extracted contract candidates are accepted as binding contracts."
    },
    contracts
  };
}

module.exports = {
  DEFAULT_CLAIMS,
  DEFAULT_CONTRACTS,
  loadJsonValidated,
  checkSourceFreshness,
  checkContractIntegrity,
  computeCoverage,
  buildContracts,
  isCritical
};
