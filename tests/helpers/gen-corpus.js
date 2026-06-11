"use strict";

const fs = require("fs");
const path = require("path");

const WORDS = [
  "the", "system", "must", "should", "never", "store", "order", "user", "page",
  "login", "api", "database", "test", "browser", "form", "data", "delete",
  "muss", "soll", "nutzer", "speichern", "kein", "seite", "formular"
];

function makeRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function randomLine(rng) {
  const length = 3 + Math.floor(rng() * 12);
  const words = [];
  for (let i = 0; i < length; i += 1) {
    words.push(WORDS[Math.floor(rng() * WORDS.length)]);
  }
  const prefixes = ["- ", "* ", "1. ", "", "## ", "> "];
  return prefixes[Math.floor(rng() * prefixes.length)] + words.join(" ") + ".";
}

function generateCorpus(targetDir, count) {
  fs.mkdirSync(targetDir, { recursive: true });
  const rng = makeRng(20260611);
  const files = [];
  for (let index = 0; index < count; index += 1) {
    const name = `corpus_${String(index).padStart(3, "0")}.md`;
    const lines = [];
    const variant = index % 10;
    const lineCount = 5 + Math.floor(rng() * 60);
    for (let line = 0; line < lineCount; line += 1) lines.push(randomLine(rng));
    let text = lines.join("\n");
    if (variant === 1) text = lines.join("\r\n");
    if (variant === 2) text = "```\n" + text;
    if (variant === 3) text = "######## deep heading\n" + text;
    if (variant === 4) text = lines.map(() => "## heading only").join("\n");
    if (variant === 5) text += "\n" + "x".repeat(5000);
    if (variant === 6) text = "äöü € emoji 😀\n" + text;
    if (variant === 7) text = text.slice(0, 60);
    if (variant === 8) text = "|" + text.split("\n").join("|\n|") + "|";
    if (variant === 9) text = "    indented code block style\n" + text;
    fs.writeFileSync(path.join(targetDir, name), text, "utf8");
    files.push(name);
  }
  return files;
}

module.exports = { generateCorpus };
