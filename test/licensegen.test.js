const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const L = require("../src");
const bin = path.join(__dirname, "../bin/licensegen.js");

test("all licenses load and render", () => {
  assert.equal(L.all().length, 12);
  for (const l of L.all()) { const t = L.render(l, { year: 2026, name: "Soumya" }); assert.ok(t.length > 100, l.key); assert.equal(L.detect(t)?.key, l.key, `detect ${l.key}`); }
  assert.match(L.render(L.resolve("mit"), { year: 2026, name: "Soumya" }), /Copyright \(c\) 2026 Soumya/);
});
test("aliases", () => { assert.equal(L.resolve("Apache").key, "apache-2.0"); assert.equal(L.resolve("GPL-3.0").key, "gpl-3.0"); assert.equal(L.resolve("BSD").key, "bsd-3-clause"); assert.equal(L.resolve("nope"), null); });
test("recommend", () => {
  assert.equal(L.recommend({}).key, "mit"); assert.equal(L.recommend({ patent: true }).key, "apache-2.0");
  assert.equal(L.recommend({ copyleft: "network" }).key, "agpl-3.0"); assert.equal(L.recommend({ copyleft: "library" }).key, "lgpl-3.0");
});
test("cli writes LICENSE + package.json", () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "lic-"));
  fs.writeFileSync(path.join(d, "package.json"), JSON.stringify({ name: "x", author: "Soumya Bhandare <s@x.dev>" }, null, 2));
  const r = spawnSync("node", [bin, "mit", "-y", "2026"], { cwd: d, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(fs.readFileSync(path.join(d, "LICENSE"), "utf8"), /2026 Soumya Bhandare\n/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(d, "package.json"))).license, "MIT");
  assert.equal(spawnSync("node", [bin, "isc"], { cwd: d }).status, 1);
  assert.equal(spawnSync("node", [bin, "isc", "--force"], { cwd: d }).status, 0);
  assert.match(spawnSync("node", [bin, "--check"], { cwd: d, encoding: "utf8" }).stdout, /ISC/);
  assert.equal(spawnSync("node", [bin, "wat"], { cwd: d }).status, 2);
});
