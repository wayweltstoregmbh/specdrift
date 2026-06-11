"use strict";

const coverage = require("./coverage.js");
const verdictsLib = require("./verdicts.js");

const FAIL_ON_VALUES = ["missing", "distorted", "both"];
const ARTIFACT_PREFIX = "specdrift.";

function parseChangedList(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[,\n]/)
    .map((entry) => entry.trim().replace(/\\/g, "/"))
    .filter((entry) => entry.length > 0);
}

function evidenceFileSet(cwd, verdictsRel) {
  const fs = require("fs");
  const path = require("path");
  const abs = path.resolve(cwd, verdictsRel);
  const files = new Set();
  if (!fs.existsSync(abs)) return files;
  try {
    const data = JSON.parse(fs.readFileSync(abs, "utf8"));
    for (const entry of data.verdicts || []) {
      for (const evidence of entry.evidence || []) files.add(evidence.file.replace(/\\/g, "/"));
    }
    for (const addition of data.additions || []) {
      for (const evidence of addition.evidence || []) files.add(evidence.file.replace(/\\/g, "/"));
    }
  } catch {
    // unreadable verdicts are reported through buildReport findings
  }
  return files;
}

function findUncoveredChanges(cwd, changed, store, verdictsRel) {
  const referenced = evidenceFileSet(cwd, verdictsRel);
  const specFiles = new Set((store ? store.sources : []).map((source) => source.file));
  return changed.filter((file) => {
    if (file.startsWith(ARTIFACT_PREFIX) || file.includes(`/${ARTIFACT_PREFIX}`)) return false;
    if (specFiles.has(file)) return false;
    return !referenced.has(file);
  });
}

function runGate(cwd, options) {
  const claimsRel = options.claimsRel || coverage.DEFAULT_CLAIMS;
  const verdictsRel = options.verdictsRel || verdictsLib.DEFAULT_VERDICTS;
  const failOn = options.failOn || "both";
  if (!FAIL_ON_VALUES.includes(failOn)) {
    throw new Error(`invalid --fail-on "${failOn}" (expected: ${FAIL_ON_VALUES.join(", ")})`);
  }
  const minCoverage = options.minCoverage !== undefined ? Number(options.minCoverage) : 0;
  if (Number.isNaN(minCoverage) || minCoverage < 0 || minCoverage > 100) {
    throw new Error(`invalid --min-coverage "${options.minCoverage}" (expected 0-100)`);
  }
  const maxUncovered = options.maxUncovered !== undefined && options.maxUncovered !== ""
    ? Number(options.maxUncovered)
    : null;
  if (maxUncovered !== null && (Number.isNaN(maxUncovered) || maxUncovered < 0)) {
    throw new Error(`invalid --max-uncovered "${options.maxUncovered}"`);
  }
  const { findings, report, store } = verdictsLib.buildReport(cwd, claimsRel, verdictsRel);
  const blocking = [...findings];
  const warnings = [];
  let uncovered = [];
  if (report) {
    if (report.unverdicted_claim_ids.length > 0) {
      blocking.push(
        `report incomplete: ${report.unverdicted_claim_ids.length} claim(s) without verdict ` +
          `(${report.unverdicted_claim_ids.join(", ")})`
      );
    }
    if (report.totals.missing > 0 && ["missing", "both"].includes(failOn)) {
      blocking.push(`${report.totals.missing} requirement(s) missing from the implementation`);
    }
    if (report.totals.distorted > 0 && ["distorted", "both"].includes(failOn)) {
      blocking.push(`${report.totals.distorted} requirement(s) implemented differently than specified`);
    }
    if (report.coverage_percent < minCoverage) {
      blocking.push(`coverage ${report.coverage_percent}% below required ${minCoverage}%`);
    }
    uncovered = findUncoveredChanges(cwd, parseChangedList(options.changed), store, verdictsRel);
    if (uncovered.length > 0) {
      const message = `${uncovered.length} changed file(s) without spec coverage: ${uncovered.join(", ")}`;
      if (maxUncovered !== null && uncovered.length > maxUncovered) {
        blocking.push(message);
      } else {
        warnings.push(message);
      }
    }
  }
  return {
    status: blocking.length > 0 ? "fail" : "pass",
    gate: { fail_on: failOn, min_coverage: minCoverage, max_uncovered: maxUncovered },
    report,
    uncovered_changes: uncovered,
    blocking_findings: blocking,
    warnings
  };
}

function driftRow(kind, entry) {
  const source = `${entry.source_file}:${entry.source_line}`;
  const reason = (entry.reason || "").replace(/\|/g, "\\|");
  const text = entry.source_text.length > 80
    ? `${entry.source_text.slice(0, 77)}...`
    : entry.source_text;
  return `| ${entry.claim_id} | ${kind} | ${source} | ${text.replace(/\|/g, "\\|")} | ${reason} |`;
}

function buildComment(result) {
  const lines = ["## SpecDrift Report", ""];
  if (!result.report) {
    lines.push(`**Status: FAIL** — ${result.blocking_findings.join("; ")}`);
    return `${lines.join("\n")}\n`;
  }
  const report = result.report;
  const icon = result.status === "pass" ? "✅" : "❌";
  lines.push(`${icon} **Status: ${result.status.toUpperCase()}** — coverage ${report.coverage_percent}%`);
  lines.push("");
  lines.push(
    `Required: ${report.totals.required} · Covered: ${report.totals.covered} · ` +
      `Missing: ${report.totals.missing} · Distorted: ${report.totals.distorted} · ` +
      `Waived: ${report.totals.waived} · Additions: ${report.additions.length}`
  );
  const driftEntries = [
    ...report.drift.missing.map((entry) => driftRow("missing", entry)),
    ...report.drift.distorted.map((entry) => driftRow("distorted", entry))
  ];
  if (driftEntries.length > 0) {
    lines.push("", "### Drift", "");
    lines.push("| Claim | Verdict | Source | Requirement | Reason |");
    lines.push("| --- | --- | --- | --- | --- |");
    lines.push(...driftEntries);
  }
  if (report.waived.length > 0) {
    lines.push("", "### Accepted deviations (waived)", "");
    for (const entry of report.waived) {
      lines.push(`- ${entry.claim_id} (${entry.source_file}:${entry.source_line}) — ` +
        `${entry.reason} _(approved by ${entry.approved_by})_`);
    }
  }
  if (report.unverdicted_claim_ids.length > 0) {
    lines.push("", `### Unverdicted claims: ${report.unverdicted_claim_ids.join(", ")}`);
  }
  if (result.uncovered_changes.length > 0) {
    lines.push("", "### Changes without spec coverage", "");
    for (const file of result.uncovered_changes) lines.push(`- ${file}`);
  }
  for (const finding of result.blocking_findings) lines.push("", `**Blocking:** ${finding}`);
  return `${lines.join("\n")}\n`;
}

module.exports = { runGate, buildComment, parseChangedList };
