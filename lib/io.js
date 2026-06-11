"use strict";

const fs = require("fs");
const path = require("path");

function writeJsonAtomic(outAbs, data) {
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  const tmp = `${outAbs}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, outAbs);
}

function resolveInRoot(root, rel, label) {
  const abs = path.resolve(root, rel);
  const rootAbs = path.resolve(root);
  if (abs !== rootAbs && !abs.startsWith(`${rootAbs}${path.sep}`)) {
    throw new Error(`${label} escapes the project root: ${rel}`);
  }
  return abs;
}

module.exports = { writeJsonAtomic, resolveInRoot };
