"use strict";

const test = require("node:test");
const assert = require("node:assert");

test("M0-N03: deliberate failure — this commit must turn CI red, then be reverted", () => {
  assert.fail("intentional failure proving the CI pipeline actually blocks on red tests");
});
