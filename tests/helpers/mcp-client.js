"use strict";

const { spawn } = require("node:child_process");
const path = require("node:path");

const SERVER = path.resolve(__dirname, "..", "..", "mcp", "server.js");

function startServer(cwd) {
  const child = spawn(process.execPath, [SERVER], { cwd, stdio: ["pipe", "pipe", "pipe"] });
  const pending = new Map();
  let buffer = "";
  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString("utf8");
    let index = buffer.indexOf("\n");
    while (index !== -1) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (line.length > 0) {
        const msg = JSON.parse(line);
        const resolver = pending.get(msg.id);
        if (resolver) {
          pending.delete(msg.id);
          resolver(msg);
        }
      }
      index = buffer.indexOf("\n");
    }
  });
  let nextId = 1;
  function request(method, params) {
    const id = nextId;
    nextId += 1;
    return new Promise((resolve, reject) => {
      pending.set(id, resolve);
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
      const timer = setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error(`timeout waiting for ${method}`));
        }
      }, 30000);
      timer.unref();
    });
  }
  async function init() {
    return request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "specdrift-test", version: "0" }
    });
  }
  function callTool(name, args) {
    return request("tools/call", { name, arguments: args });
  }
  return { child, request, init, callTool, kill: () => child.kill() };
}

function dataOf(response) {
  return JSON.parse(response.result.content[0].text);
}

function textOf(response) {
  return response.result.content[0].text;
}

module.exports = { startServer, dataOf, textOf };
