"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const DIR = path.join(__dirname, "../licenses");
const ALIASES = { apache: "apache-2.0", apache2: "apache-2.0", gpl: "gpl-3.0", gpl3: "gpl-3.0", agpl: "agpl-3.0", lgpl: "lgpl-3.0", bsd: "bsd-3-clause", bsd2: "bsd-2-clause", bsd3: "bsd-3-clause", mpl: "mpl-2.0", boost: "bsl-1.0", unlicensed: "unlicense", "public-domain": "unlicense" };
const POPULAR = ["mit", "apache-2.0", "gpl-3.0", "bsd-3-clause", "isc", "mpl-2.0", "agpl-3.0", "lgpl-3.0", "bsd-2-clause", "unlicense", "bsl-1.0", "0bsd"];
let cache;
function all() { return (cache ??= POPULAR.map((k) => JSON.parse(fs.readFileSync(path.join(DIR, k + ".json"), "utf8")))); }
function resolve(id) {
  const k = String(id || "").toLowerCase().trim(); const key = ALIASES[k] || k;
  return all().find((l) => l.key === key || l.spdx_id.toLowerCase() === key) || null;
}
function render(lic, { year = new Date().getFullYear(), name = "" } = {}) {
  let b = lic.body;
  b = b.replace(/\[year\]|\[yyyy\]/g, String(year)).replace(/\[fullname\]|\[name of copyright owner\]/g, name || "[fullname]");
  return b.endsWith("\n") ? b : b + "\n";
}
function detectAuthor(cwd = process.cwd()) {
  try { const p = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8")); const a = typeof p.author === "string" ? p.author.replace(/\s*[<(].*$/, "") : p.author?.name; if (a) return { name: a.trim(), from: "package.json" }; } catch {}
  try { const n = execFileSync("git", ["config", "user.name"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); if (n) return { name: n, from: "git config" }; } catch {}
  return { name: "", from: null };
}
/** Detect an existing LICENSE file's type by fingerprint. */
function detect(text) {
  const t = String(text).replace(/\s+/g, " ").toLowerCase();
  const fp = [["agpl-3.0", "gnu affero general public license"], ["lgpl-3.0", "gnu lesser general public license"], ["gpl-3.0", "gnu general public license"], ["apache-2.0", "apache license"], ["mpl-2.0", "mozilla public license"], ["bsl-1.0", "boost software license"], ["unlicense", "this is free and unencumbered software"], ["bsd-3-clause", "neither the name of the copyright holder"], ["bsd-2-clause", "redistributions in binary form must reproduce"], ["0bsd", "permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted. the software is provided"], ["isc", "permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that"], ["mit", "permission is hereby granted, free of charge"]];
  const head = t.slice(0, 300);
  for (const [k, s] of fp.slice(0, 3)) if (head.includes(s)) return resolve(k);
  for (const [k, s] of fp.slice(3)) if (t.includes(s)) return resolve(k);
  return null;
}
/** Recommend from answers: {permissive:boolean, patent:boolean, copyleft:'none'|'file'|'library'|'strong'|'network'} */
function recommend({ copyleft = "none", patent = false, attribution = true } = {}) {
  if (copyleft === "network") return resolve("agpl-3.0");
  if (copyleft === "strong") return resolve("gpl-3.0");
  if (copyleft === "library") return resolve("lgpl-3.0");
  if (copyleft === "file") return resolve("mpl-2.0");
  if (!attribution) return resolve("unlicense");
  return resolve(patent ? "apache-2.0" : "mit");
}
function setPackageLicense(cwd, spdx) {
  const p = path.join(cwd, "package.json"); if (!fs.existsSync(p)) return false;
  const raw = fs.readFileSync(p, "utf8"), j = JSON.parse(raw); if (j.license === spdx) return false;
  j.license = spdx; fs.writeFileSync(p, JSON.stringify(j, null, /^(\s+)"/m.exec(raw)?.[1] || "  ") + "\n"); return true;
}
module.exports = { all, resolve, render, detectAuthor, detect, recommend, setPackageLicense, POPULAR };
