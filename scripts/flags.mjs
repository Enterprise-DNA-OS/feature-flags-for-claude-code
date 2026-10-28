import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { getDb, REPO_ROOT } from "./lib/db.mjs";
import { table as textTable } from "./lib/format.mjs";
import { page, table, writeOut } from "./lib/render.mjs";
import {
  validateDocument,
  createEvaluator,
  digest,
  canonical,
} from "./lib/evaluate.mjs";

export const reports = {
  environments:
    "select id,name,owner,revision,(select count(*)::int from jsonb_object_keys(document->'f')) flags from environments order by name",
  inventory: "select * from flag_inventory order by environment,key",
  attention: "select * from attention_items order by environment,issue,item",
  "changes-due":
    "select * from change_queue where state in ('pending','approved') order by due_on,code",
  compliance:
    "select * from compliance_findings order by rule,environment,item",
  "review-due":
    "select environment,key,owner,review_on from flag_inventory where review_on is null or review_on<=current_date+30 order by review_on nulls first",
  "owner-load":
    "select coalesce(nullif(owner,''),'Unassigned') owner,count(*)::int flags,count(*) filter(where review_on<current_date or review_on is null)::int reviews_due from flag_inventory group by owner order by reviews_due desc,owner",
  "environment-drift":
    "select a.key,a.environment left_environment,b.environment right_environment,a.default_value left_value,b.default_value right_value from flag_inventory a join flag_inventory b on a.key=b.key and a.environment<b.environment where a.default_value<>b.default_value order by a.key",
  releases:
    "select r.id,e.name environment,r.revision,c.code change,r.actor,r.reason,r.created_at from releases r join environments e on e.id=r.environment_id left join changes c on c.id=r.change_id order by r.created_at desc,r.id",
  "test-history":
    "select x.id,c.code,x.actor,x.passed,x.results,x.created_at from checks x join changes c on c.id=x.change_id order by x.created_at desc,x.id",
  decisions:
    "select c.code,d.actor,d.decision,d.evidence,d.created_at from decisions d join changes c on c.id=d.change_id order by d.created_at desc,d.id",
  activity:
    "select actor,action,reference,detail,created_at from activity order by created_at desc,id",
  imports:
    "select e.name environment,i.digest,i.flag_count,i.actor,i.created_at from imports i join environments e on e.id=i.environment_id order by i.created_at desc",
};
export const commands = [
  ...Object.keys(reports),
  "help",
  "show",
  "weekly-review",
  "add-environment",
  "add",
  "set-default",
  "assign",
  "propose",
  "test-change",
  "approve",
  "reject",
  "release",
  "rollback",
  "evaluate",
  "import",
  "export",
  "write-release",
  "log",
  "draft-review",
  "draft-release",
];
const need = (o, k) => {
  if (typeof o[k] !== "string" || !o[k].trim()) throw Error("Required --" + k);
  return o[k].trim();
};
export function date(s) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    new Date(s + "T00:00:00Z").toISOString().slice(0, 10) !== s
  )
    throw Error("Invalid date: " + s);
  return s;
}
function jsonFile(file) {
  return JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
}
export async function resolve(db, kind, ref) {
  const names = {
    environments: "name",
    changes: "code",
    releases: "id",
    flag_register: "key",
  };
  const col = names[kind];
  if (!col) throw Error("Unknown record kind");
  if (!ref) throw Error("Required record reference");
  const rows = await db.query(
    `select * from ${kind} where id::text=$1 or lower(${col}::text)=lower($1) or id::text like $2 or position(lower($1) in lower(${col}::text))>0 order by ${col}`,
    [ref, ref + "%"],
  );
  const exact = rows.filter(
    (r) => r.id === ref || String(r[col]).toLowerCase() === ref.toLowerCase(),
  );
  const hits = exact.length ? exact : rows;
  if (hits.length !== 1)
    throw Error(
      hits.length
        ? "Ambiguous " +
            kind +
            ": " +
            hits.map((r) => `${r.id} ${r[col]}`).join("; ")
        : "No " + kind + " match: " + ref,
    );
  return hits[0];
}
async function audit(db, o, action, reference, detail) {
  await db.query(
    "insert into activity(actor,action,reference,detail) values($1,$2,$3,$4)",
    [need(o, "actor"), action, reference, JSON.stringify(detail)],
  );
}
async function lockedEnv(db, ref) {
  const e = await resolve(db, "environments", ref);
  return (
    await db.query("select * from environments where id=$1 for update", [e.id])
  )[0];
}
async function lockedChange(db, ref) {
  let c = await resolve(db, "changes", ref);
  const e = await lockedEnv(db, c.environment_id);
  c = (
    await db.query("select * from changes where id=$1 for update", [c.id])
  )[0];
  return { c, e };
}
function current(c, e) {
  if (c.base_revision !== e.revision)
    throw Error(
      "Stale proposal: create a new proposal against the current revision",
    );
}
async function registerFlags(db, e, doc) {
  for (const key of Object.keys(doc.f))
    await db.query(
      "insert into flag_register(environment_id,key) values($1,$2) on conflict do nothing",
      [e.id, key],
    );
}
async function proposal(db, o, e, doc) {
  validateDocument(doc);
  if (canonical(doc) === canonical(e.document))
    throw Error("No configuration change");
  const code = need(o, "code");
  const rows = await db.query(
    "insert into changes(code,environment_id,base_revision,document,requested_by,reason,due_on,impact,rollback_plan) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id,code,state,base_revision",
    [
      code,
      e.id,
      e.revision,
      JSON.stringify(doc),
      need(o, "actor"),
      need(o, "reason"),
      date(need(o, "due-on")),
      need(o, "impact"),
      need(o, "rollback"),
    ],
  );
  await audit(db, o, "propose", code, {
    base_revision: e.revision,
    digest: digest(doc),
  });
  return rows;
}
async function testChange(db, o) {
  const { c, e } = await lockedChange(db, need(o, "ref"));
  current(c, e);
  if (c.state !== "pending") throw Error("Only pending changes can be tested");
  const cases = jsonFile(need(o, "cases"));
  if (!Array.isArray(cases) || !cases.length)
    throw Error("At least one test case is required");
  const changed = [
    ...new Set([...Object.keys(c.document.f), ...Object.keys(e.document.f)]),
  ].filter((k) => canonical(c.document.f[k]) !== canonical(e.document.f[k]));
  // A prerequisite edit can affect dependent flags even when their own text is unchanged.
  for (let i = 0; i < changed.length; i++) {
    for (const document of [e.document, c.document]) {
      for (const [key, flag] of Object.entries(document.f)) {
        if (
          !changed.includes(key) &&
          flag.r?.some((rule) =>
            rule.c?.some((condition) => condition.p?.f === changed[i]),
          )
        )
          changed.push(key);
      }
    }
  }
  // Changes to shared segments/salt affect every flag, so require every key in that case.
  if (
    canonical(c.document.s) !== canonical(e.document.s) ||
    canonical(c.document.p) !== canonical(e.document.p)
  )
    changed.splice(
      0,
      changed.length,
      ...new Set([...Object.keys(c.document.f), ...Object.keys(e.document.f)]),
    );
  const missing = changed.filter((k) => !cases.some((x) => x.key === k));
  if (missing.length)
    throw Error("Tests missing changed flags: " + missing.join(", "));
  const evaluator = createEvaluator(c.document);
  const results = [];
  try {
    for (const x of cases) {
      if (
        typeof x.key !== "string" ||
        (!Object.hasOwn(x, "expected") && x.absent !== true)
      )
        throw Error("Each case requires key and expected, or absent=true");
      if (x.absent === true) {
        results.push({
          key: x.key,
          expected: "absent",
          actual: Object.hasOwn(c.document.f, x.key) ? "present" : "absent",
          passed: !Object.hasOwn(c.document.f, x.key),
        });
        continue;
      }
      try {
        const actual = await evaluator.evaluate(x.key, x.user);
        results.push({
          key: x.key,
          user: x.user?.identifier || "(default)",
          expected: x.expected,
          actual: actual.value,
          passed: canonical(x.expected) === canonical(actual.value),
        });
      } catch (error) {
        results.push({
          key: x.key,
          expected: x.expected,
          error: error.message,
          passed: false,
        });
      }
    }
  } finally {
    evaluator.close();
  }
  const passed = results.every((r) => r.passed);
  await db.query(
    "insert into checks(change_id,actor,passed,cases,results) values($1,$2,$3,$4,$5)",
    [
      c.id,
      need(o, "actor"),
      passed,
      JSON.stringify(cases),
      JSON.stringify(results),
    ],
  );
  await audit(db, o, "test-change", c.code, { passed, cases: cases.length });
  return results;
}
export async function run(db, cmd, o = {}, pos = []) {
  if (!commands.includes(cmd)) throw Error("Unknown command: " + cmd);
  if (reports[cmd]) return db.query(reports[cmd]);
  if (cmd === "help") return commands.map((command) => ({ command }));
  if (cmd === "show")
    return [await resolve(db, o.kind || "changes", need(o, "ref"))];
  if (cmd === "weekly-review")
    return {
      attention: await run(db, "attention"),
      changes: await run(db, "changes-due"),
      owners: await run(db, "owner-load"),
    };
  if (cmd === "evaluate") {
    const e = await resolve(db, "environments", need(o, "env"));
    const ev = createEvaluator(e.document);
    try {
      return [
        await ev.evaluate(
          need(o, "key"),
          o.user ? JSON.parse(o.user) : undefined,
        ),
      ];
    } finally {
      ev.close();
    }
  }
  if (cmd === "export") {
    const data = { format: "feature-flags-backup-v1" };
    await db.exec("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    try {
      for (const name of [
        "environments",
        "flag_register",
        "changes",
        "checks",
        "decisions",
        "releases",
        "activity",
        "imports",
      ])
        data[name] = await db.query("select * from " + name);
      await db.exec("COMMIT");
    } catch (e) {
      await db.exec("ROLLBACK");
      throw e;
    }
    const file = path.resolve(need(o, "file"));
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    return [{ file, format: data.format }];
  }
  if (cmd === "write-release") {
    const r = await resolve(db, "releases", need(o, "ref"));
    const file = path.resolve(need(o, "file"));
    fs.writeFileSync(file, JSON.stringify(r.document, null, 2) + "\n", {
      flag: "wx",
      mode: 0o600,
    });
    return [
      {
        file,
        revision: r.revision,
        digest: digest(r.document),
        status: "local file only",
      },
    ];
  }
  if (cmd.startsWith("draft-")) {
    let sections;
    if (cmd === "draft-release") {
      const c = await resolve(db, "changes", need(o, "ref"));
      sections = [
        {
          title: "Change request",
          html: table([
            {
              code: c.code,
              requester: c.requested_by,
              reason: c.reason,
              impact: c.impact,
              rollback: c.rollback_plan,
              state: c.state,
            },
          ]),
        },
        {
          title: "Recorded tests",
          html: table(
            await db.query(
              "select actor,passed,results,created_at from checks where change_id=$1 order by created_at",
              [c.id],
            ),
          ),
        },
      ];
    } else
      sections = [
        { title: "Attention", html: table(await run(db, "attention")) },
        { title: "Changes", html: table(await run(db, "changes-due")) },
      ];
    const file = writeOut(
      "drafts",
      cmd + "-" + randomUUID(),
      page({
        title:
          cmd === "draft-release" ? "Release handover" : "Weekly flag review",
        subtitle:
          "Draft for human review. No delivery or deployment has happened.",
        sections,
      }),
    );
    return [{ file }];
  }
  o = { ...o, actor: need(o, "actor") };
  await db.exec("BEGIN");
  try {
    let result;
    if (cmd === "add-environment") {
      const name = need(o, "name");
      result = await db.query(
        "insert into environments(name,owner) values($1,$2) returning id,name,revision",
        [name, need(o, "owner")],
      );
      await db.query(
        "insert into releases(environment_id,revision,document,actor,reason) values($1,0,$2,$3,$4)",
        [result[0].id, '{"f":{}}', o.actor, "Empty initial baseline"],
      );
      await audit(db, o, cmd, name, {});
    } else if (cmd === "import") {
      if (pos[0] !== "configcat") throw Error("Use import configcat");
      const name = need(o, "env"),
        doc = validateDocument(jsonFile(need(o, "file"))),
        hash = digest(doc);
      const existing = await db.query(
        "select * from environments where lower(name)=lower($1) for update",
        [name],
      );
      if (existing.length > 1) throw Error("Ambiguous environment");
      let e = existing[0];
      if (e && canonical(e.document) !== canonical(doc))
        throw Error(
          "Environment already exists with different data; use propose to change it",
        );
      const unchanged = !!e;
      if (!e) {
        [e] = await db.query(
          "insert into environments(name,owner,document) values($1,$2,$3) returning *",
          [name, need(o, "owner"), JSON.stringify(doc)],
        );
        await registerFlags(db, e, doc);
        await db.query(
          "insert into releases(environment_id,revision,document,actor,reason) values($1,0,$2,$3,$4)",
          [
            e.id,
            JSON.stringify(doc),
            o.actor,
            "Imported baseline, not deployed",
          ],
        );
      }
      if (!unchanged) {
        await db.query(
          "insert into imports(environment_id,digest,flag_count,actor) values($1,$2,$3,$4)",
          [e.id, hash, Object.keys(doc.f).length, o.actor],
        );
        await audit(db, o, cmd, e.name, {
          digest: hash,
          flags: Object.keys(doc.f).length,
        });
      }
      result = [
        {
          environment: name,
          flags: Object.keys(doc.f).length,
          unchanged,
          dry_run: !!o["dry-run"],
          digest: hash,
        },
      ];
    } else if (["propose", "add", "set-default", "rollback"].includes(cmd)) {
      const e = await lockedEnv(db, need(o, "env"));
      let doc;
      if (cmd === "propose") doc = jsonFile(need(o, "file"));
      else if (cmd === "rollback") {
        const r = await resolve(db, "releases", need(o, "ref"));
        if (r.environment_id !== e.id)
          throw Error("Release belongs to another environment");
        doc = r.document;
      } else {
        doc = structuredClone(e.document);
        const key = need(o, "key");
        if (["__proto__", "constructor", "prototype"].includes(key))
          throw Error("Invalid flag key");
        const value = JSON.parse(need(o, "value"));
        if (cmd === "add") {
          if (Object.hasOwn(doc.f, key)) throw Error("Flag already exists");
          const t =
            typeof value === "boolean"
              ? 0
              : typeof value === "string"
                ? 1
                : Number.isSafeInteger(value)
                  ? 2
                  : typeof value === "number"
                    ? 3
                    : -1;
          doc.f[key] = { t, v: { [["b", "s", "i", "d"][t]]: value } };
        } else {
          if (!Object.hasOwn(doc.f, key)) throw Error("Unknown flag");
          doc.f[key].v = { [["b", "s", "i", "d"][doc.f[key].t]]: value };
        }
      }
      result = await proposal(db, o, e, doc);
    } else if (cmd === "assign") {
      const e = await lockedEnv(db, need(o, "env")),
        key = need(o, "key");
      if (!Object.hasOwn(e.document.f, key)) throw Error("Unknown flag");
      const [before] = await db.query(
        "select owner,purpose,review_on from flag_register where environment_id=$1 and key=$2",
        [e.id, key],
      );
      result = await db.query(
        "update flag_register set owner=$3,purpose=$4,review_on=$5 where environment_id=$1 and key=$2 returning key,owner,purpose,review_on",
        [
          e.id,
          key,
          need(o, "owner"),
          need(o, "purpose"),
          date(need(o, "review-on")),
        ],
      );
      await audit(db, o, cmd, e.name + "/" + key, { before, after: result[0] });
    } else if (cmd === "test-change") result = await testChange(db, o);
    else if (["approve", "reject", "release"].includes(cmd)) {
      const { c, e } = await lockedChange(db, need(o, "ref"));
      if (cmd !== "reject") current(c, e);
      if (cmd === "release") {
        if (c.state !== "approved") throw Error("Change must be approved");
        const [test] = await db.query(
          "select passed from checks where change_id=$1 order by created_at desc,id desc limit 1",
          [c.id],
        );
        if (!test?.passed) throw Error("Latest tests must pass");
        const approvals = await db.query(
          "select id from decisions where change_id=$1 and decision='approve' and lower(actor)<>lower($2)",
          [c.id, c.requested_by],
        );
        if (!approvals.length) throw Error("Separate reviewer required");
        await db.query(
          "update environments set document=$2,revision=revision+1 where id=$1",
          [e.id, JSON.stringify(c.document)],
        );
        await registerFlags(db, e, c.document);
        result = await db.query(
          "insert into releases(environment_id,change_id,revision,document,actor,reason) values($1,$2,$3,$4,$5,$6) returning id,revision",
          [
            e.id,
            c.id,
            e.revision + 1,
            JSON.stringify(c.document),
            o.actor,
            need(o, "evidence"),
          ],
        );
        await db.query("update changes set state='released' where id=$1", [
          c.id,
        ]);
      } else {
        if (cmd === "approve") {
          if (c.state !== "pending")
            throw Error("Only pending changes can be approved");
          if (o.actor.toLowerCase() === c.requested_by.toLowerCase())
            throw Error("Separate reviewer required");
          const [test] = await db.query(
            "select passed from checks where change_id=$1 order by created_at desc,id desc limit 1",
            [c.id],
          );
          if (!test?.passed) throw Error("Latest tests must pass");
        } else if (!["pending", "approved"].includes(c.state))
          throw Error("Only open changes can be rejected");
        await db.query(
          "insert into decisions(change_id,actor,decision,evidence) values($1,$2,$3,$4)",
          [c.id, o.actor, cmd, need(o, "evidence")],
        );
        result = await db.query(
          "update changes set state=$2 where id=$1 returning code,state",
          [c.id, cmd === "approve" ? "approved" : "rejected"],
        );
      }
      await audit(db, o, cmd, c.code, { evidence: need(o, "evidence") });
    } else if (cmd === "log") {
      const ref = need(o, "ref");
      await resolve(db, o.kind || "changes", ref);
      await audit(db, o, "note", ref, { note: need(o, "note") });
      result = [{ reference: ref, logged: true }];
    }
    if (o["dry-run"]) await db.exec("ROLLBACK");
    else await db.exec("COMMIT");
    return result;
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}
export function parseArgs(args) {
  let cmd = args.shift() || "help";
  if (cmd === "--help") cmd = "help";
  const o = {},
    pos = [];
  for (let i = 0; i < args.length; i++) {
    const s = args[i];
    if (s.startsWith("--")) {
      const [k, ...value] = s.slice(2).split("=");
      o[k] = value.length
        ? value.join("=")
        : ["json", "dry-run"].includes(k)
          ? true
          : args[++i];
    } else pos.push(s);
  }
  return { cmd, o, pos };
}
export function format(result) {
  if (Array.isArray(result)) {
    if (!result.length) return "  (none)";
    return textTable(
      result,
      Object.keys(result[0]).map((key) => ({
        key,
        label: key,
        format: (v) =>
          v && typeof v === "object" ? JSON.stringify(v) : String(v ?? ""),
        width: 80,
      })),
    );
  }
  return Object.entries(result)
    .map(([k, v]) => k + "\n" + format(v))
    .join("\n\n");
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const { cmd, o, pos } = parseArgs(process.argv.slice(2));
  let db;
  try {
    db = await getDb();
    const result = await run(db, cmd, o, pos);
    console.log(o.json ? JSON.stringify(result, null, 2) : format(result));
    if (cmd === "test-change" && result.some((r) => !r.passed))
      process.exitCode = 1;
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    if (db) await db.close();
  }
}
