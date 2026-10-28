import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { getDb, REPO_ROOT } from "./lib/db.mjs";
import { migrate } from "./migrate.mjs";
import { seed } from "./seed.mjs";
import { run, commands, reports, parseArgs, date } from "./flags.mjs";
import { createEvaluator, validateDocument, digest } from "./lib/evaluate.mjs";
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "flags-test-"));
process.env.DATA_DIR = path.join(tmp, "db");
process.env.OUTPUT_DIR = tmp;
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || "";
const db = await getDb();
let closed = false,
  checks = 0;
const seen = new Set();
const eq = (a, b) => {
    assert.deepEqual(a, b);
    checks++;
  },
  ok = (v) => {
    assert.ok(v);
    checks++;
  };
const call = (cmd, o = {}, p = []) => {
  seen.add(cmd);
  return run(db, cmd, o, p);
};
const fail = async (cmd, o, re, p = []) => {
  await assert.rejects(() => call(cmd, o, p), re);
  checks++;
};
const actor = { actor: "Lin" },
  env = "Kauri production";
const write = (name, data) => {
  const f = path.join(tmp, name);
  fs.writeFileSync(f, JSON.stringify(data));
  return f;
};
const make = {
  ...actor,
  env,
  code: "TEST-01",
  reason: "Operator request",
  impact: "Change default for the cohort",
  rollback: "Restore baseline snapshot",
  "due-on": "2099-01-01",
};
try {
  if (db.mode === "postgres")
    eq(
      (
        await db.query(
          "select count(*)::int n from information_schema.tables where table_schema='public'",
        )
      )[0].n,
      0,
    );
  eq((await migrate(db)).ran.length, 1);
  eq((await migrate(db)).ran.length, 0);
  await seed(db);
  await seed(db);
  eq((await call("environments")).length, 2);
  eq((await call("inventory")).length, 6);
  eq((await call("releases")).length, 2);
  for (const c of Object.keys(reports)) ok(Array.isArray(await call(c)));
  eq((await call("help")).length, commands.length);
  ok((await call("weekly-review")).attention.length > 0);
  eq((await call("show", { ref: "checkout-01" }))[0].code, "CHECKOUT-01");
  await fail("show", { kind: "environments", ref: "Kauri" }, /Ambiguous/);
  await fail(
    "show",
    { kind: "environments", ref: "10000000-0000-4000-8000-00000000000" },
    /Ambiguous/,
  );
  await fail("show", { ref: "absent" }, /No changes/);
  eq(
    (
      await call("evaluate", {
        env,
        key: "new_checkout",
        user: '{"identifier":"x","country":"NZ"}',
      })
    )[0].value,
    true,
  );
  eq(
    (
      await call("evaluate", {
        env,
        key: "new_checkout",
        user: '{"identifier":"x","country":"AU"}',
      })
    )[0].value,
    false,
  );
  await fail("evaluate", { env, key: "unknown" }, /Unknown flag/);
  await fail(
    "approve",
    { ref: "CHECKOUT-01", actor: "Mere", evidence: "Review" },
    /tests must pass/,
  );
  await call("test-change", {
    ref: "CHECKOUT-01",
    cases: path.join(REPO_ROOT, "fixtures/checkout-tests.json"),
    ...actor,
  });
  const badCases = write("bad-cases.json", [
    { key: "new_checkout", expected: false },
  ]);
  eq(
    (
      await call("test-change", {
        ref: "CHECKOUT-01",
        cases: badCases,
        ...actor,
      })
    )[0].passed,
    false,
  );
  await fail(
    "approve",
    { ref: "CHECKOUT-01", actor: "Mere", evidence: "Review" },
    /tests must pass/,
  );
  await call("test-change", {
    ref: "CHECKOUT-01",
    cases: path.join(REPO_ROOT, "fixtures/checkout-tests.json"),
    ...actor,
  });
  await fail(
    "approve",
    { ref: "CHECKOUT-01", actor: "  lin  ", evidence: "Self approval" },
    /Separate reviewer/,
  );
  await fail("approve", { ref: "CHECKOUT-01", actor: "Mere" }, /evidence/);
  const initial = (await call("show", { kind: "environments", ref: env }))[0];
  const proposed = structuredClone(initial.document);
  proposed.f.retry_limit.v.i = 4;
  await call("propose", { ...make, file: write("proposal.json", proposed) });
  await call("approve", {
    ref: "CHECKOUT-01",
    actor: "Mere",
    evidence: "Case matrix reviewed",
  });
  await fail(
    "test-change",
    { ref: "CHECKOUT-01", cases: badCases, ...actor },
    /pending/,
  );
  const [release] = await call("release", {
    ref: "CHECKOUT-01",
    ...actor,
    evidence: "Local release approved",
  });
  eq(release.revision, 1);
  await fail(
    "release",
    { ref: "CHECKOUT-01", ...actor, evidence: "Again" },
    /Stale|approved/,
  );
  await fail(
    "test-change",
    { ref: "TEST-01", cases: badCases, ...actor },
    /Stale/,
  );
  await fail(
    "approve",
    { ref: "TEST-01", actor: "Mere", evidence: "Old" },
    /Stale/,
  );
  await call("reject", {
    ref: "TEST-01",
    actor: "Mere",
    evidence: "Rebase needed",
  });
  const baseline = (await call("releases")).find(
    (r) => r.environment === env && r.revision === 0,
  );
  await call("rollback", { ...make, code: "ROLLBACK-01", ref: baseline.id });
  const rollbackCases = write("rollback-cases.json", [
    {
      key: "new_checkout",
      user: { identifier: "au", country: "AU" },
      expected: false,
    },
    {
      key: "new_checkout",
      user: { identifier: "nz", country: "NZ" },
      expected: true,
    },
  ]);
  await call("test-change", {
    ref: "ROLLBACK-01",
    cases: rollbackCases,
    ...actor,
  });
  await call("approve", {
    ref: "ROLLBACK-01",
    actor: "Mere",
    evidence: "Rollback reviewed",
  });
  await call("release", {
    ref: "ROLLBACK-01",
    ...actor,
    evidence: "Rollback baseline recorded",
  });
  eq(
    (
      await call("evaluate", {
        env,
        key: "new_checkout",
        user: '{"identifier":"au","country":"AU"}',
      })
    )[0].value,
    false,
  );
  await call("add", { ...make, code: "ADD-01", key: "new_limit", value: "8" });
  await fail(
    "test-change",
    { ref: "ADD-01", cases: badCases, ...actor },
    /missing changed flags/,
  );
  await call("test-change", {
    ref: "ADD-01",
    cases: write("add-cases.json", [{ key: "new_limit", expected: 8 }]),
    ...actor,
  });
  await call("approve", {
    ref: "ADD-01",
    actor: "Mere",
    evidence: "Integer checked",
  });
  await call("release", { ref: "ADD-01", ...actor, evidence: "Add flag" });
  await fail(
    "add",
    { ...make, code: "BAD", key: "new_limit", value: "9" },
    /already exists/,
  );
  await fail(
    "set-default",
    { ...make, code: "BAD", key: "new_limit", value: '"oops"' },
    /declared type|Type mismatch/,
  );
  await call("set-default", {
    ...make,
    code: "SET-01",
    key: "new_limit",
    value: "9",
  });
  await call("assign", {
    env,
    key: "legacy_banner",
    owner: "Mere",
    purpose: "Retire banner after review",
    "review-on": "2099-01-01",
    ...actor,
  });
  await fail(
    "assign",
    {
      env,
      key: "new_limit",
      owner: "Mere",
      purpose: "Limit",
      "review-on": "2026-02-30",
      ...actor,
    },
    /Invalid/,
  );
  await fail(
    "assign",
    {
      env,
      key: "new_limit",
      owner: "Mere",
      purpose: "Limit",
      "review-on": "2099-01-01",
    },
    /actor/,
  );
  await call("log", {
    ref: "SET-01",
    note: "<script>alert(1)</script>",
    ...actor,
  });
  await call("add-environment", {
    name: "Testing <script>",
    owner: "Mere",
    ...actor,
  });
  const source = path.join(REPO_ROOT, "fixtures/configcat-v6.json"),
    imp = { file: source, env: "Imported", owner: "Mere", ...actor };
  eq(
    (await call("import", { ...imp, "dry-run": true }, ["configcat"]))[0].flags,
    6,
  );
  eq((await call("imports")).length, 0);
  eq((await call("import", imp, ["configcat"]))[0].unchanged, false);
  eq((await call("import", imp, ["configcat"]))[0].unchanged, true);
  eq((await call("imports")).length, 1);
  const native = JSON.parse(fs.readFileSync(source));
  const dependentChange = structuredClone(native);
  dependentChange.f.beta.v.b = true;
  await call("propose", {
    ...make,
    env: "Imported",
    code: "DEPENDENT-01",
    file: write("dependent.json", dependentChange),
  });
  await fail(
    "test-change",
    {
      ref: "DEPENDENT-01",
      cases: write("dependent-short.json", [{ key: "beta", expected: true }]),
      ...actor,
    },
    /dependent/,
  );
  await call("test-change", {
    ref: "DEPENDENT-01",
    cases: write("dependent-full.json", [
      { key: "beta", expected: true },
      { key: "dependent", expected: true },
    ]),
    ...actor,
  });
  const errorRun = await call("test-change", {
    ref: "DEPENDENT-01",
    cases: write("eval-error.json", [
      { key: "beta", expected: true },
      { key: "dependent", expected: true },
      { key: "absent", expected: true },
    ]),
    ...actor,
  });
  eq(errorRun.at(-1).passed, false);
  await fail(
    "approve",
    {
      ref: "DEPENDENT-01",
      actor: "Mere",
      evidence: "Evaluation error must block",
    },
    /tests must pass/,
  );
  const shared = structuredClone(native);
  shared.p = { s: "test-salt", r: 0 };
  await call("propose", {
    ...make,
    env: "Imported",
    code: "SHARED-01",
    file: write("shared.json", shared),
  });
  await fail(
    "test-change",
    {
      ref: "SHARED-01",
      cases: write("shared-short.json", [{ key: "beta", expected: false }]),
      ...actor,
    },
    /missing changed flags/,
  );
  const doc = JSON.parse(fs.readFileSync(source));
  eq(
    digest(
      (await call("show", { kind: "environments", ref: "Imported" }))[0]
        .document,
    ),
    digest(doc),
  );
  doc.f.limit.v.i = 9;
  await fail(
    "import",
    { ...imp, file: write("different.json", doc) },
    /different data/,
    ["configcat"],
  );
  const invalid = structuredClone(doc);
  invalid.f.beta.t = 7;
  await fail(
    "import",
    { ...imp, env: "Bad import", file: write("invalid.json", invalid) },
    /Unsupported flag|Invalid config/,
    ["configcat"],
  );
  await fail(
    "show",
    { kind: "environments", ref: "Bad import" },
    /No environments/,
  );
  const ev = createEvaluator(doc);
  try {
    eq(
      (await ev.evaluate("dependent", { identifier: "nz", country: "NZ" }))
        .value,
      true,
    );
    eq(
      (await ev.evaluate("dependent", { identifier: "au", country: "AU" }))
        .value,
      false,
    );
    for (const key of Object.keys(doc.f))
      ok(
        (await ev.evaluate(key, { identifier: "stable", country: "NZ" }))
          .value !== undefined,
      );
    eq(
      (await ev.evaluate("experiment", { identifier: "same" })).value,
      (await ev.evaluate("experiment", { identifier: "same" })).value,
    );
  } finally {
    ev.close();
  }
  const cyclic = structuredClone(doc);
  cyclic.f.beta.r = [
    {
      c: [{ p: { f: "dependent", c: 0, v: { b: true } } }],
      s: { v: { b: true } },
    },
  ];
  assert.throws(() => validateDocument(cyclic), /Cyclic/);
  checks++;
  const pct = structuredClone(doc);
  pct.f.experiment.p[0].p = 60;
  assert.throws(() => validateDocument(pct), /100/);
  checks++;
  const seg = structuredClone(doc);
  seg.f.beta.r[0].c[0].s.s = 99;
  assert.throws(() => validateDocument(seg), /segment/);
  checks++;
  const removed = structuredClone(
    (await call("show", { kind: "environments", ref: env }))[0].document,
  );
  delete removed.f.new_limit;
  await call("propose", {
    ...make,
    code: "REMOVE-01",
    file: write("remove.json", removed),
  });
  await fail(
    "test-change",
    { ref: "REMOVE-01", cases: badCases, ...actor },
    /missing changed flags/,
  );
  ok(
    (
      await call("test-change", {
        ref: "REMOVE-01",
        cases: write("removed-cases.json", [
          { key: "new_limit", absent: true },
        ]),
        ...actor,
      })
    )[0].passed,
  );
  const out = path.join(tmp, "backup.json");
  await call("export", { file: out });
  ok(JSON.parse(fs.readFileSync(out)).changes.length > 4);
  await fail("export", { file: out }, /EEXIST/);
  const releaseFile = path.join(tmp, "release.json");
  await call("write-release", { ref: release.id, file: releaseFile });
  eq(JSON.parse(fs.readFileSync(releaseFile)).f.new_checkout.v.b, true);
  await fail("write-release", { ref: release.id, file: releaseFile }, /EEXIST/);
  for (const cmd of ["draft-review", "draft-release"]) {
    const [d] = await call(cmd, { ref: "CHECKOUT-01" });
    ok(fs.readFileSync(d.file, "utf8").includes("Draft for human review"));
  }
  eq([...seen].sort(), [...commands].sort());
  eq(
    (
      await db.query(
        "select count(*)::int n from pg_class where relname in ('environments','flag_register','changes','checks','decisions','releases','activity','imports') and relrowsecurity",
      )
    )[0].n,
    8,
  );
  eq(
    parseArgs(["import", "configcat", "--actor", "A", "--dry-run"]).o.actor,
    "A",
  );
  assert.throws(() => date("2026-02-30"), /Invalid/);
  checks++;
  await db.close();
  closed = true;
  for (const script of ["docs", "view"]) {
    const result = spawnSync(process.execPath, [`scripts/${script}.mjs`], {
      cwd: REPO_ROOT,
      env: process.env,
      encoding: "utf8",
    });
    eq(result.status, 0);
  }
  const docFiles = fs.readdirSync(
    path.join(tmp, "docs-out/environment-register"),
  );
  const html = docFiles
    .map((f) =>
      fs.readFileSync(
        path.join(tmp, "docs-out/environment-register", f),
        "utf8",
      ),
    )
    .join("");
  ok(html.includes("&lt;script&gt;"));
  ok(!html.includes("<script>"));
  const cli = spawnSync(
    process.execPath,
    [
      "scripts/flags.mjs",
      "show",
      "--kind=environments",
      "--ref=Kauri",
      "--json",
    ],
    { cwd: REPO_ROOT, env: process.env, encoding: "utf8" },
  );
  eq(cli.status, 1);
  ok(cli.stderr.includes("Ambiguous"));
  const good = spawnSync(
    process.execPath,
    ["scripts/flags.mjs", "inventory", "--json"],
    { cwd: REPO_ROOT, env: process.env, encoding: "utf8" },
  );
  eq(good.status, 0);
  ok(JSON.parse(good.stdout).length > 6);
  console.log(
    `PASS: ${checks} assertions; ${commands.length} CLI commands; ${db.mode}; atomic imports, offline targeting, approval, stale changes, rollback and escaped reports.`,
  );
} finally {
  if (!closed) await db.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
