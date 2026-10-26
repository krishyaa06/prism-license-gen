#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline/promises");
const { parseArgs } = require("node:util");
const L = require("../src");
const { c, header, table, plural } = require("../src/ui");
const pkg = require("../package.json");

const HELP = `${header("licensegen", "add a LICENSE in one command")}

${c.bold("Usage")}
  licensegen mit                  write LICENSE (author from package.json / git)
  licensegen apache -n "Soumya"   set the copyright holder
  licensegen                      interactive: answer 3 questions, get a pick
  licensegen --list               all licenses, compared
  licensegen --info gpl           permissions / conditions / limitations
  licensegen --check              detect the LICENSE already in this folder

${c.bold("Options")}
  -n, --name <name>     copyright holder
  -y, --year <year>     copyright year (default: this year)
  -o, --out <file>      output file (default: LICENSE, "-" for stdout)
      --force           overwrite an existing LICENSE
      --no-pkg          don't update "license" in package.json
  -v, --version / -h, --help`;

let a;
try { a = parseArgs({ allowPositionals: true, options: { name: { type: "string", short: "n" }, year: { type: "string", short: "y" }, out: { type: "string", short: "o", default: "LICENSE" }, force: { type: "boolean" }, "no-pkg": { type: "boolean" }, list: { type: "boolean", short: "l" }, info: { type: "string" }, check: { type: "boolean" }, version: { type: "boolean", short: "v" }, help: { type: "boolean", short: "h" } } }); }
catch (e) { console.error(c.red(`✖ ${e.message}`)); process.exit(2); }
const o = a.values;
if (o.help) { console.log(HELP); process.exit(0); }
if (o.version) { console.log(pkg.version); process.exit(0); }
const yes = (s) => c.green("✔"), no = () => c.dim("·");
const has = (l, f, k) => l[f].includes(k);

if (o.list) {
  console.log(header("licensegen", `${L.all().length} licenses`));
  console.log("\n" + table(L.all().map((l) => [c.bold(l.spdx_id), has(l, "permissions", "commercial-use") ? yes() : no(), has(l, "permissions", "patent-use") ? yes() : no(), has(l, "conditions", "disclose-source") ? c.yellow("✔") : no(), has(l, "conditions", "network-use-disclose") ? c.yellow("✔") : no(), has(l, "conditions", "include-copyright") ? yes() : no(), c.dim(l.name.replace(/ License| Version.*$/g, ""))]), { head: ["SPDX", "COMMERCIAL", "PATENTS", "COPYLEFT", "NETWORK", "ATTRIBUTION", "NAME"], align: ["l", "c", "c", "c", "c", "c"] }));
  console.log(`\n${c.dim("Not sure? Run")} ${c.cyan("licensegen")} ${c.dim("with no arguments.")}`); process.exit(0);
}
if (o.info) {
  const l = L.resolve(o.info); if (!l) { console.error(c.red(`✖ Unknown license: ${o.info}`)); process.exit(2); }
  console.log(header("licensegen", l.name)); console.log(`\n${l.description}\n`);
  const label = (s) => s.replace(/-/g, " ");
  for (const [k, col, icon] of [["permissions", c.green, "✔"], ["conditions", c.cyan, "•"], ["limitations", c.red, "✖"]]) console.log(`${c.bold(k[0].toUpperCase() + k.slice(1))}\n${l[k].map((x) => `  ${col(icon)} ${label(x)}`).join("\n") || c.dim("  none")}\n`);
  process.exit(0);
}
if (o.check) {
  const f = ["LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING"].find((x) => fs.existsSync(x));
  if (!f) { console.log(`${c.yellow("⚠")} No LICENSE file here. Add one: ${c.cyan("licensegen mit")}`); process.exit(1); }
  const l = L.detect(fs.readFileSync(f, "utf8")); const holder = /copyright \(c\) (\d{4}(?:\s*-\s*\d{4})?)\s+(.+)/i.exec(fs.readFileSync(f, "utf8"));
  console.log(l ? `${c.green("✔")} ${c.bold(f)} is ${c.accent(l.spdx_id)}${holder ? c.dim(` · © ${holder[1]} ${holder[2].trim()}`) : ""}` : `${c.yellow("⚠")} ${f} exists but the license wasn't recognised`);
  process.exit(0);
}

(async () => {
  let lic;
  if (a.positionals[0]) { lic = L.resolve(a.positionals[0]); if (!lic) { console.error(c.red(`✖ Unknown license "${a.positionals[0]}". Try: ${L.POPULAR.join(", ")}`)); process.exit(2); } }
  else {
    if (!process.stdin.isTTY) { console.error(c.red("✖ Pass a license id, e.g. licensegen mit")); process.exit(2); }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log(header("licensegen", "3 quick questions"));
    const q = async (s) => /^y/i.test((await rl.question(`\n${c.accent("?")} ${s} ${c.dim("(y/N)")} `)).trim());
    let copyleft = "none";
    if (await q("Must people who modify & share your code keep it open source?")) copyleft = (await q("Even when it only runs on a server (SaaS)?")) ? "network" : (await q("Is it a library others link into closed apps (allow that)?")) ? "library" : "strong";
    const patent = copyleft === "none" && (await q("Want an explicit patent grant (good for companies)?"));
    rl.close();
    lic = L.recommend({ copyleft, patent });
    console.log(`\n${c.green("→")} ${c.bold(lic.spdx_id)} ${c.dim("— " + lic.description.split(". ")[0] + ".")}\n`);
  }
  const who = o.name ? { name: o.name, from: "--name" } : L.detectAuthor();
  const text = L.render(lic, { year: o.year, name: who.name });
  if (o.out === "-") { process.stdout.write(text); process.exit(0); }
  if (fs.existsSync(o.out) && !o.force) { const ex = L.detect(fs.readFileSync(o.out, "utf8")); console.error(c.yellow(`⚠ ${o.out} already exists${ex ? ` (${ex.spdx_id})` : ""} — use --force to replace it`)); process.exit(1); }
  fs.writeFileSync(o.out, text);
  console.log(`${c.green("✔")} Wrote ${c.bold(o.out)} ${c.accent(lic.spdx_id)} ${c.dim(`© ${o.year || new Date().getFullYear()} ${who.name || "[fullname]"}${who.from ? ` (from ${who.from})` : ""}`)}`);
  if (!who.name && /\[fullname\]/.test(text)) console.log(`${c.yellow("⚠")} No author found — edit ${o.out} or pass ${c.cyan('-n "Your Name"')}`);
  if (!o["no-pkg"] && L.setPackageLicense(process.cwd(), lic.spdx_id)) console.log(`${c.green("✔")} Set ${c.bold('"license": "' + lic.spdx_id + '"')} in package.json`);
})();
