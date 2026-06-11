"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const NON_GOAL_SECTION = new RegExp(
  "\\b(non.?goals?|nicht.?ziele|out of scope|ausgeschlossen|non.?objectives)\\b",
  "i"
);
const MUST_NOT_RE = new RegExp(
  "\\b(never|forbidden|must not|shall not|darf nicht|keine|kein|nicht erlaubt|auf keinen fall)\\b",
  "i"
);
const MUST_RE = new RegExp(
  "\\b(must|required|shall|zwingend|muss|muessen|auf jeden fall|exactly|genau)\\b",
  "i"
);
const ACCEPTANCE_RE = new RegExp(
  "\\b(acceptance|abnahme|test|proof|beweis|verify|validieren|nachweis)\\b",
  "i"
);
const SHOULD_RE = /\b(should|sollte|sollten|soll|empfohlen|recommended)\b/i;
const SECURITY_RE = new RegExp(
  "\\b(2fa|mfa|two.factor|nonce|csrf|capability|permission|role|rolle|login|auth|password|passwort|" +
    "encrypt|encryption|tls|xss|security|sicherheit)\\b",
  "i"
);
const TECHNICAL_RE = new RegExp(
  "\\b(promptchain|pipeline|stage|stufe|api|database|datenbank|schema|method|methode|workflow|adapter|" +
    "webhook|rest|cron|queue|cache)\\b",
  "i"
);
const DATA_RE = new RegExp(
  "\\b(gdpr|dsgvo|privacy|datenschutz|personenbezogen|personal data|pii|retention|loesch|delete|email|e-mail)\\b",
  "i"
);
const UI_RE = new RegExp(
  "\\b(ui|button|formular|form|shortcode|screen|page|ansicht|browser|mobile|desktop|click|klick)\\b",
  "i"
);
const FEATURE_RE = /\b(user|kunde|visitor|nutzer|feature|funktion|prozess|flow|ziel|build|erstellen)\b/i;

function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function claimStrength(text) {
  if (MUST_NOT_RE.test(text)) return "must_not";
  if (MUST_RE.test(text)) return "must";
  if (ACCEPTANCE_RE.test(text)) return "acceptance";
  if (SHOULD_RE.test(text)) return "should";
  return "context";
}

function claimType(text, strength) {
  const value = String(text || "");
  if (strength === "must_not") return "forbidden";
  if (SECURITY_RE.test(value)) return "security_must";
  if (TECHNICAL_RE.test(value)) return "technical_must";
  if (DATA_RE.test(value)) return "data";
  if (UI_RE.test(value)) return "ui";
  if (strength === "acceptance") return "acceptance";
  if (FEATURE_RE.test(value)) return "feature";
  return "context";
}

function evidenceCandidates(type, strength) {
  const evidence = new Set();
  if (["must", "must_not", "acceptance"].includes(strength)) evidence.add("contract_review");
  if (type === "security_must") {
    evidence.add("security_test");
    evidence.add("code_review");
  }
  if (type === "technical_must") {
    evidence.add("unit_or_integration_test");
    evidence.add("architecture_review");
  }
  if (type === "forbidden") {
    evidence.add("negative_test");
    evidence.add("guard_check");
  }
  if (type === "data") {
    evidence.add("data_schema_review");
    evidence.add("compliance_review");
  }
  if (["ui", "acceptance", "feature"].includes(type)) evidence.add("practical_test");
  if (type === "ui") evidence.add("browser_evidence");
  if (evidence.size === 0) evidence.add("human_review");
  return Array.from(evidence).sort();
}

function riskTags(type, strength) {
  const tags = new Set();
  if (["must", "must_not", "acceptance"].includes(strength)) tags.add("binding_requirement");
  if (type === "security_must") tags.add("security");
  if (type === "technical_must") tags.add("technical_mechanism");
  if (type === "forbidden") tags.add("forbidden_substitution");
  if (type === "data") tags.add("compliance");
  if (type === "ui") tags.add("user_experience");
  if (type === "acceptance") tags.add("acceptance");
  return Array.from(tags).sort();
}

function readSpecText(absPath) {
  const buf = fs.readFileSync(absPath);
  if (buf.includes(0)) throw new Error(`binary file is not a valid spec source: ${absPath}`);
  const text = buf.toString("utf8");
  const replacements = (text.match(/�/g) || []).length;
  if (text.length > 0 && replacements / text.length > 0.05) {
    throw new Error(`file is not valid UTF-8 text: ${absPath}`);
  }
  return text;
}

function extractFromText(text, sourceFile, sourceHash) {
  const lines = text.split(/\r?\n/);
  const sectionPath = [];
  const claims = [];
  let inFence = false;
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (/^```/.test(trimmed)) {
      inFence = !inFence;
      continue;
    }
    const heading = !inFence ? trimmed.match(/^(#{1,6})\s+(.+?)\s*$/) : null;
    if (heading) {
      const level = heading[1].length;
      sectionPath.splice(level - 1);
      sectionPath[level - 1] = heading[2].trim();
      continue;
    }
    if (inFence) continue;
    const statement = trimmed.replace(/^[-*+]\s+/, "").replace(/^\d+[.)]\s+/, "").trim();
    if (!statement || statement.length < 4) continue;
    const sections = sectionPath.filter(Boolean);
    const isBoundary = sections.some((section) => NON_GOAL_SECTION.test(section));
    const strength = claimStrength(statement);
    let type = claimType(statement, strength);
    let candidate = ["must", "must_not", "acceptance"].includes(strength)
      || ["security_must", "technical_must", "forbidden", "data", "acceptance"].includes(type);
    let binding = candidate ? "needs_confirmation" : "context_only";
    let tags = riskTags(type, strength);
    let evidence = evidenceCandidates(type, strength);
    if (isBoundary) {
      type = "boundary";
      candidate = false;
      binding = "boundary";
      tags = ["scope_boundary"];
      evidence = ["human_review"];
    }
    claims.push({
      claim_id: "",
      source_file: sourceFile,
      source_hash: sourceHash,
      source_line_start: index + 1,
      source_line_end: index + 1,
      source_text: statement,
      section_path: sections.slice(),
      claim_type: type,
      strength,
      binding_status: binding,
      contract_candidate: candidate,
      risk_tags: tags,
      evidence_candidates: evidence,
      requires_human_confirmation: candidate
    });
  }
  return claims;
}

function collectSpecFiles(rootAbs) {
  const out = [];
  const walk = (rel) => {
    const abs = path.join(rootAbs, rel);
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(childRel);
      else if (entry.name.toLowerCase().endsWith(".md")) out.push(childRel);
    }
  };
  walk("");
  return out.sort();
}

function buildClaimStore(targetAbs, displayPath) {
  const stat = fs.statSync(targetAbs);
  const sourceEntries = [];
  if (stat.isDirectory()) {
    const files = collectSpecFiles(targetAbs);
    if (files.length === 0) {
      throw new Error(`no markdown spec files found in directory: ${displayPath}`);
    }
    for (const rel of files) {
      const text = readSpecText(path.join(targetAbs, rel));
      sourceEntries.push({ file: `${displayPath}/${rel}`, text, hash: sha256(text) });
    }
  } else {
    const text = readSpecText(targetAbs);
    sourceEntries.push({ file: displayPath, text, hash: sha256(text) });
  }
  const totalLength = sourceEntries.reduce((sum, entry) => sum + entry.text.trim().length, 0);
  if (totalLength === 0) throw new Error(`spec source is empty: ${displayPath}`);
  if (totalLength < 80) {
    throw new Error(`spec source is too small for loss-aware extraction (<80 chars): ${displayPath}`);
  }
  const claims = [];
  for (const entry of sourceEntries) {
    claims.push(...extractFromText(entry.text, entry.file, entry.hash));
  }
  claims.forEach((claim, index) => {
    claim.claim_id = `claim_${String(index + 1).padStart(3, "0")}`;
  });
  return {
    $schema: "https://specdrift.dev/schemas/claims.schema.json",
    schema_version: "1.0",
    tool: "specdrift extract",
    extracted_at: new Date().toISOString(),
    sources: sourceEntries.map((entry) => ({
      file: entry.file,
      hash: entry.hash,
      line_count: entry.text.split(/\r?\n/).length
    })),
    claims
  };
}

module.exports = { buildClaimStore, extractFromText, readSpecText, sha256 };
