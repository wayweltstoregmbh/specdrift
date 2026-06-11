"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const FIXTURES = path.join(__dirname, "fixtures");
const { startServer, dataOf, textOf } = require(path.join(__dirname, "helpers", "mcp-client.js"));

const REQUIRED = ["claim_001", "claim_002", "claim_003", "claim_004", "claim_006"];

function prepDir(label) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), `specdrift-${label}-`));
  fs.copyFileSync(path.join(FIXTURES, "en-spec.md"), path.join(cwd, "spec.md"));
  fs.writeFileSync(path.join(cwd, "impl.js"), "line1\nline2\nline3\n", "utf8");
  return cwd;
}

async function withServer(label, fn) {
  const cwd = prepDir(label);
  const server = startServer(cwd);
  try {
    await server.init();
    await fn(server, cwd);
  } finally {
    server.kill();
  }
}

test("M4-P01: tools/list exposes exactly the five tools with schema-valid definitions", async () => {
  await withServer("p01", async (server) => {
    const response = await server.request("tools/list", {});
    const tools = response.result.tools;
    assert.deepStrictEqual(
      tools.map((tool) => tool.name).sort(),
      ["check_coverage", "drift_report", "extract_claims", "get_claims", "record_verdict"]
    );
    for (const tool of tools) {
      assert.ok(tool.description.length > 10, `${tool.name} needs a description`);
      assert.strictEqual(tool.inputSchema.type, "object");
      assert.ok(tool.inputSchema.properties, `${tool.name} needs properties`);
    }
  });
});

test("M4-P02: end-to-end extract, verdicts and complete drift report over MCP", async () => {
  await withServer("p02", async (server) => {
    const extract = dataOf(await server.callTool("extract_claims", { spec_path: "spec.md" }));
    assert.strictEqual(extract.claim_count, 6);
    for (const id of REQUIRED) {
      const response = await server.callTool("record_verdict", {
        claim_id: id,
        verdict: "covered",
        evidence: "impl.js:2"
      });
      assert.ok(!response.result.isError, textOf(response));
    }
    const report = dataOf(await server.callTool("drift_report", {}));
    assert.strictEqual(report.report_status, "complete");
    assert.strictEqual(report.totals.covered, 5);
    assert.strictEqual(report.coverage_percent, 100);
  });
});

test("M4-P03: a deliberately dropped requirement shows up as exactly that missing claim", async () => {
  await withServer("p03", async (server) => {
    await server.callTool("extract_claims", { spec_path: "spec.md" });
    for (const id of REQUIRED) {
      if (id === "claim_003") continue;
      await server.callTool("record_verdict", {
        claim_id: id,
        verdict: "covered",
        evidence: "impl.js:1"
      });
    }
    await server.callTool("record_verdict", {
      claim_id: "claim_003",
      verdict: "missing",
      reason: "two-factor authentication was not implemented"
    });
    const report = dataOf(await server.callTool("drift_report", {}));
    assert.strictEqual(report.totals.missing, 1);
    assert.strictEqual(report.drift.missing.length, 1);
    assert.strictEqual(report.drift.missing[0].claim_id, "claim_003");
    assert.match(report.drift.missing[0].source_text, /two-factor/);
  });
});

test("M4-P04: the claim store survives a server restart", async () => {
  const cwd = prepDir("p04");
  const first = startServer(cwd);
  await first.init();
  await first.callTool("extract_claims", { spec_path: "spec.md" });
  first.kill();
  const second = startServer(cwd);
  try {
    await second.init();
    const store = dataOf(await second.callTool("get_claims", {}));
    assert.strictEqual(store.claims.length, 6);
  } finally {
    second.kill();
  }
});

test("M4-P05: concurrent verdict calls keep the store consistent", async () => {
  await withServer("p05", async (server, cwd) => {
    await server.callTool("extract_claims", { spec_path: "spec.md" });
    const responses = await Promise.all(
      REQUIRED.map((id) =>
        server.callTool("record_verdict", { claim_id: id, verdict: "covered", evidence: "impl.js" })
      )
    );
    for (const response of responses) assert.ok(!response.result.isError, textOf(response));
    const file = JSON.parse(
      fs.readFileSync(path.join(cwd, "specdrift.verdicts.json"), "utf8")
    );
    assert.strictEqual(file.verdicts.length, 5);
    assert.deepStrictEqual(file.verdicts.map((entry) => entry.claim_id).sort(), REQUIRED);
  });
});

test("M4-N01: invalid tool arguments return a structured error and the server stays alive", async () => {
  await withServer("n01", async (server) => {
    const response = await server.callTool("record_verdict", { verdict: "covered" });
    assert.strictEqual(response.result.isError, true);
    assert.match(textOf(response), /invalid arguments/);
    assert.match(textOf(response), /claim_id/);
    const ping = await server.request("ping", {});
    assert.deepStrictEqual(ping.result, {});
  });
});

test("M4-N02: record_verdict before extract_claims names the next step", async () => {
  await withServer("n02", async (server) => {
    const response = await server.callTool("record_verdict", {
      claim_id: "claim_001",
      verdict: "covered",
      evidence: "impl.js"
    });
    assert.strictEqual(response.result.isError, true);
    assert.match(textOf(response), /extract_claims/);
  });
});

test("M4-N03: an oversized spec is rejected with a bounded error, no hang", async () => {
  await withServer("n03", async (server, cwd) => {
    fs.writeFileSync(path.join(cwd, "huge.md"), "x".repeat(10 * 1024 * 1024), "utf8");
    const response = await server.callTool("extract_claims", { spec_path: "huge.md" });
    assert.strictEqual(response.result.isError, true);
    assert.match(textOf(response), /too large/);
  });
});

test("M4-N04: path traversal in tool file parameters is rejected", async () => {
  await withServer("n04", async (server) => {
    const escape = await server.callTool("extract_claims", { spec_path: "../outside.md" });
    assert.strictEqual(escape.result.isError, true);
    assert.match(textOf(escape), /escapes the project root/);
    const out = await server.callTool("extract_claims", {
      spec_path: "spec.md",
      out_path: "../../stolen.json"
    });
    assert.strictEqual(out.result.isError, true);
    assert.match(textOf(out), /escapes the project root/);
  });
});

test("M4-N05: a kill right after a write request never corrupts the stores", async () => {
  const cwd = prepDir("n05");
  const first = startServer(cwd);
  await first.init();
  await first.callTool("extract_claims", { spec_path: "spec.md" });
  first.child.stdin.write(
    `${JSON.stringify({
      jsonrpc: "2.0",
      id: 99,
      method: "tools/call",
      params: {
        name: "record_verdict",
        arguments: { claim_id: "claim_001", verdict: "covered", evidence: "impl.js" }
      }
    })}\n`
  );
  first.kill();
  await new Promise((resolve) => first.child.on("close", resolve));
  const claims = JSON.parse(fs.readFileSync(path.join(cwd, "specdrift.claims.json"), "utf8"));
  assert.ok(Array.isArray(claims.claims));
  const verdictsPath = path.join(cwd, "specdrift.verdicts.json");
  if (fs.existsSync(verdictsPath)) {
    const verdicts = JSON.parse(fs.readFileSync(verdictsPath, "utf8"));
    assert.ok(Array.isArray(verdicts.verdicts));
  }
  assert.ok(!fs.existsSync(`${verdictsPath}.tmp`), "no partial tmp artifact may remain");
  const second = startServer(cwd);
  try {
    await second.init();
    const response = await second.callTool("record_verdict", {
      claim_id: "claim_002",
      verdict: "covered",
      evidence: "impl.js",
      overwrite: true
    });
    assert.ok(!response.result.isError, textOf(response));
  } finally {
    second.kill();
  }
});
