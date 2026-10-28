import * as cc from "@configcat/sdk/node";
import { randomUUID, createHash } from "node:crypto";
export function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonical(value[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export const digest = (value) =>
  createHash("sha256").update(canonical(value)).digest("hex");
export function validateDocument(document) {
  if (
    !document ||
    Array.isArray(document) ||
    typeof document !== "object" ||
    !document.f ||
    Array.isArray(document.f) ||
    typeof document.f !== "object"
  )
    throw Error(
      "Expected ConfigCat v6 environment document with an f object; not a product backup",
    );
  for (const key of Object.keys(document))
    if (!["p", "s", "f"].includes(key))
      throw Error("Unknown document property: " + key);
  cc.deserializeConfig(JSON.stringify(document));
  const keys = Object.keys(document.f),
    edges = new Map(keys.map((k) => [k, []]));
  const checkValue = (v, t) => {
    const field = ["b", "s", "i", "d"][t],
      value = v?.[field];
    if (
      !field ||
      !v ||
      Object.keys(v).length !== 1 ||
      typeof value !== ["boolean", "string", "number", "number"][t] ||
      (t === 2 && !Number.isSafeInteger(value)) ||
      (t >= 2 && !Number.isFinite(value))
    )
      throw Error("Flag value does not match its declared type");
  };
  const percentages = (ps, t) => {
    if (ps === undefined) return;
    if (
      !ps.length ||
      ps.some((p) => !Number.isInteger(p.p) || p.p < 0) ||
      ps.reduce((s, p) => s + p.p, 0) !== 100
    )
      throw Error("Percentage options must total 100");
    for (const p of ps) checkValue(p.v, t);
  };
  const user = (u) => {
    if (!Number.isInteger(u.c) || u.c < 0 || u.c > 35)
      throw Error("Unknown user comparator");
    if ((u.c >= 16 && u.c <= 17) || (u.c >= 20 && u.c <= 27)) {
      if (!document.p?.s)
        throw Error("Confidential comparison needs the original salt");
    }
  };
  for (const s of document.s || []) for (const u of s.r || []) user(u);
  for (const [key, f] of Object.entries(document.f)) {
    if (!key || ["__proto__", "constructor", "prototype"].includes(key))
      throw Error("Invalid flag key");
    if (![0, 1, 2, 3].includes(f.t)) throw Error("Unsupported flag type");
    checkValue(f.v, f.t);
    percentages(f.p, f.t);
    for (const r of f.r || []) {
      if (Boolean(r.s) === Boolean(r.p))
        throw Error("Rule requires exactly one result");
      if (!r.c?.length) throw Error("Rule needs conditions");
      if (r.s) checkValue(r.s.v, f.t);
      percentages(r.p, f.t);
      for (const c of r.c) {
        if (["u", "s", "p"].filter((x) => c[x] !== undefined).length !== 1)
          throw Error("Condition requires one comparator");
        if (c.u) user(c.u);
        if (
          c.s &&
          (![0, 1].includes(c.s.c) ||
            !Number.isInteger(c.s.s) ||
            !document.s?.[c.s.s])
        )
          throw Error("Invalid segment reference");
        if (c.p) {
          if (![0, 1].includes(c.p.c) || !document.f[c.p.f])
            throw Error("Invalid prerequisite reference");
          checkValue(c.p.v, document.f[c.p.f].t);
          edges.get(key).push(c.p.f);
        }
      }
    }
  }
  const done = new Set(),
    visiting = new Set();
  function visit(k) {
    if (visiting.has(k)) throw Error("Cyclic prerequisite flags");
    if (done.has(k)) return;
    visiting.add(k);
    edges.get(k).forEach(visit);
    visiting.delete(k);
    done.add(k);
  }
  keys.forEach(visit);
  return document;
}
// ConfigCat's MIT-licensed evaluator preserves its own rule and percentage semantics.
// A local-only source plus an offline client and a rejecting fetcher prevents network reads.
export function createEvaluator(document) {
  validateDocument(document);
  const settings = cc.deserializeConfig(JSON.stringify(document)).f;
  const client = cc.getClient(
    "local-" + randomUUID(),
    cc.PollingMode.ManualPoll,
    {
      offline: true,
      flagOverrides: {
        dataSource: { getOverrides: () => settings },
        behaviour: cc.OverrideBehaviour.LocalOnly,
      },
      configFetcher: {
        fetchAsync: async () => {
          throw Error("Network disabled");
        },
      },
      logger: cc.createConsoleLogger(cc.LogLevel.Off),
    },
  );
  return {
    async evaluate(key, user) {
      if (!Object.hasOwn(document.f, key)) throw Error("Unknown flag: " + key);
      const d = await client.getValueDetailsAsync(key, null, user);
      if (d.isDefaultValue || d.errorMessage)
        throw Error(d.errorMessage || "Evaluation returned fallback");
      return {
        key,
        value: d.value,
        matched_rule: !!d.matchedTargetingRule,
        matched_percentage: !!d.matchedPercentageOption,
      };
    },
    close: () => client.dispose(),
  };
}
