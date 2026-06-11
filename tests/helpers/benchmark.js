"use strict";

const VERBS = [
  "persist", "encrypt", "validate", "render", "archive",
  "throttle", "export", "merge", "schedule", "redact"
];
const OBJECTS = [
  "orders", "invoices", "sessions", "avatars", "coupons",
  "tickets", "payouts", "reviews", "alerts", "drafts"
];
const COMPONENTS = [
  "gateway", "ledger", "vault", "renderer", "indexer",
  "limiter", "exporter", "merger", "scheduler", "redactor"
];

function makeRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function generateScenario(rng, scenarioIndex) {
  const claimCount = 8 + Math.floor(rng() * 5);
  const statements = [];
  for (let i = 0; i < claimCount; i += 1) {
    const verb = `${VERBS[Math.floor(rng() * VERBS.length)]}${scenarioIndex}v${i}`;
    const obj = `${OBJECTS[Math.floor(rng() * OBJECTS.length)]}${scenarioIndex}x${i}`;
    const comp = `${COMPONENTS[Math.floor(rng() * COMPONENTS.length)]}${scenarioIndex}y${i}`;
    const n = 10 + i;
    statements.push(`${verb} ${obj} via ${comp} after ${n} retries.`);
  }
  const truth = new Map();
  const implLines = ["# Implementation notes"];
  statements.forEach((statement, i) => {
    const roll = i % 4 === 1 ? "missing" : i % 4 === 3 ? "distorted" : "covered";
    if (roll === "covered") {
      truth.set(statement, "covered");
      implLines.push(statement);
    } else if (roll === "missing") {
      truth.set(statement, "missing");
    } else {
      truth.set(statement, "distorted");
      const mutated = statement
        .replace(/ (\w+) via /, " changedthing via ")
        .replace(/after (\d+) retries/, "after 999 retries");
      implLines.push(mutated);
    }
  });
  const specLines = ["# Benchmark Scenario", "", "## Requirements", ""];
  for (const statement of statements) specLines.push(`- ${statement}`);
  return {
    specText: `${specLines.join("\n")}\n`,
    implText: `${implLines.join("\n")}\n`,
    truth
  };
}

function generateBenchmark(count) {
  const rng = makeRng(424242);
  const scenarios = [];
  for (let index = 0; index < count; index += 1) {
    scenarios.push(generateScenario(rng, index));
  }
  return scenarios;
}

module.exports = { generateBenchmark };
