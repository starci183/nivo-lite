import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { byKey, proposeFact } from "./brain/facts";
import { keyOf, sameValue, type Evidence, type Scope } from "./brain/shared";
import { logEvidence } from "./core";
import { enqueueWorkspaceSync } from "./engine-queue";
import type { EngineCtx } from "./engine";
import type { AuthorityRule } from "./flow-types";
import { actionDef, moduleName, type ModuleKey } from "./module-registry";
import {
  targetKey, type FactPayload, type OpenGap, type ProposedWrite, type Resolution, type RulePayload, type SetupWrite, type WriteDecision, type WriteResult, type WriteStatus,
} from "./module-setup-writes";
import { saveRuleCore } from "./owner-chat";
import { supabaseAdmin } from "./supabase/admin";
import type { Locale } from "@/i18n/core";

type Db = SupabaseClient;

type Row = {
  id: string; workspace_id: string; setup_session_id: string; source_message_id: string | null; gate_key: string; kind: "fact" | "rule"; target_key: string
  payload: FactPayload | RulePayload; status: WriteStatus; result: WriteResult | null; decided_by: string | null; created_at: string
};

const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message); };

const toWrite = (r: Row, current: SetupWrite["current"]): SetupWrite => ({
  id: r.id, setupSessionId: r.setup_session_id, sourceMessageId: r.source_message_id, gateKey: r.gate_key, status: r.status, result: r.result,
  decidedBy: r.decided_by, createdAt: r.created_at, kind: r.kind, payload: r.payload, current,
} as SetupWrite);

/* ------------------------------------------------------------------ current values (the conflict) */

/** The rule in force for an action: the stored row, else what installing the module grants. */
const ruleInForce = async (db: Db, ws: string, action: RulePayload["action"]): Promise<{ mode: RulePayload["mode"]; limitVnd: number | null; requiredFields: Array<string> }> => {
  const { data } = await db.from("authority_rules").select("*").eq("workspace_id", ws).eq("action", action).maybeSingle();
  const row = data as AuthorityRule | null;
  if (row) return { mode: row.mode, limitVnd: row.limit_vnd, requiredFields: row.required_fields ?? [] };
  const def = actionDef(action);
  return { mode: def.mode, limitVnd: def.limitVnd, requiredFields: [...def.requiredFields] };
};

/** The active fact for the same subject + attribute in one scope (the brain keeps exactly one per scope: shared, or one instance's own). */
const factInForce = async (ws: string, p: Pick<FactPayload, "subjectLabel" | "attributeLabel">, installationId: string | null = null) => {
  const [active] = await byKey(supabaseAdmin(), ws, keyOf(p.subjectLabel), keyOf(p.attributeLabel), "active", installationId);
  return active ?? null;
};

const currentOf = async (db: Db, ws: string, r: Row): Promise<SetupWrite["current"]> => {
  if (r.status !== "proposed") return null;
  if (r.kind === "fact") {
    const active = await factInForce(ws, r.payload as FactPayload);
    return active ? { value: active.value, scope: active.scope, modules: active.modules } : null;
  }
  const rule = await ruleInForce(db, ws, (r.payload as RulePayload).action);
  return { mode: rule.mode, limitVnd: rule.limitVnd };
};

/* ------------------------------------------------------------------ store and load */

/**
 * Store the writes a turn proposed as confirm cards. A rule card is completed with the half the owner did not change (mode or limit) from the
 * rule in force; a rule that would change nothing is dropped. A waiting card for the same target is replaced (marked superseded).
 */
export const storeWrites = async (
  db: Db, ws: string, setupSessionId: string, sourceMessageId: string, proposed: ReadonlyArray<ProposedWrite>,
): Promise<void> => {
  for (const w of proposed) {
    let payload: FactPayload | RulePayload;
    if (w.kind === "fact") payload = w.payload;
    else {
      const have = await ruleInForce(db, ws, w.payload.action);
      const mode = w.payload.mode ?? have.mode;
      const limitVnd = w.payload.limitVnd === undefined ? have.limitVnd : w.payload.limitVnd;
      if (mode === have.mode && limitVnd === have.limitVnd) continue;
      payload = { action: w.payload.action, field: w.payload.field, mode, limitVnd };
    }
    const key = targetKey(w);
    fail((await db.from("module_setup_writes").update({ status: "superseded" }).eq("setup_session_id", setupSessionId).eq("target_key", key).eq("status", "proposed")).error);
    fail((await db.from("module_setup_writes").insert({
      workspace_id: ws, setup_session_id: setupSessionId, source_message_id: sourceMessageId, gate_key: w.gateKey, kind: w.kind, target_key: key, payload,
    })).error);
  }
};

/** Every write card of the given setup sessions, oldest first (superseded ones are hidden). Waiting cards carry the value in force. */
export const loadWrites = async (db: Db, ws: string, sessionIds: ReadonlyArray<string>): Promise<Array<SetupWrite>> => {
  if (sessionIds.length === 0) return [];
  const { data, error } = await db.from("module_setup_writes").select("*").in("setup_session_id", [...sessionIds]).neq("status", "superseded").order("created_at");
  if (error) return []; // before the migration ran: the chat still works, without cards
  const rows = (data ?? []) as Array<Row>;
  return Promise.all(rows.map(async (r) => toWrite(r, await currentOf(db, ws, r))));
};

/* ------------------------------------------------------------------ open knowledge gaps */

/**
 * The questions customers asked that the module's agent could not answer (knowledge_gaps, status open), most asked first. The table is
 * added by another change: when it is missing or unreadable this returns nothing and the setup chat simply has no gaps to ask about.
 */
export const openGapsFor = async (db: Db, ws: string, moduleKey: ModuleKey, limit = 5): Promise<Array<OpenGap>> => {
  try {
    const { data, error } = await db.from("knowledge_gaps").select("id, question, topic, attribute_guess, count")
      .eq("workspace_id", ws).eq("module", moduleKey).eq("status", "open").order("count", { ascending: false }).limit(limit);
    if (error || !Array.isArray(data)) return [];
    return (data as Array<{ id: string; question: string; topic: string | null; attribute_guess: string | null; count: number }>)
      .map((g) => ({ id: g.id, question: g.question, topic: g.topic, attributeGuess: g.attribute_guess, count: g.count }));
  } catch {
    return [];
  }
};

const markGapAnswered = async (ws: string, gapId: string, by: string): Promise<void> => {
  try {
    await supabaseAdmin().from("knowledge_gaps").update({ status: "answered", answered_at: new Date().toISOString(), answered_by: by, updated_at: new Date().toISOString() })
      .eq("workspace_id", ws).eq("id", gapId).eq("status", "open");
  } catch { /* the gaps table is optional */ }
};

/* ------------------------------------------------------------------ deciding a card */

const SCOPES: ReadonlyArray<Scope> = ["public", "internal", "restricted"];

/**
 * The owner decides one card. Reject: nothing is written. Confirm (with the owner's edits, if any):
 *  - fact: proposeFact with source "owner" (auto-applied), evidence pointing at the setup message, restricted facts limited to this module. If a
 *    different value is in force the owner must have chosen: replace (history kept), keep (nothing written) or keep both (a separate fact for a
 *    named situation, the way the Brain's conflict card splits);
 *  - rule: the same authority write the /authority page uses (saveRuleCore), logged as evidence.
 */
export const decideWrite = async (
  db: Db, ctx: EngineCtx, moduleKey: ModuleKey, locale: Locale, writeId: string, change: WriteDecision,
  /** The instance whose setup chat this is, when its type allows several (a fact confirmed "only for this agent" is scoped to it). */
  instance: { readonly id: string; readonly isMulti: boolean } | null = null,
): Promise<SetupWrite> => {
  const { data, error } = await db.from("module_setup_writes").select("*").eq("workspace_id", ctx.ws).eq("id", writeId).maybeSingle();
  fail(error);
  const row = data as Row | null;
  if (!row) throw new Error("Not found");
  if (row.status !== "proposed") throw new Error("Already decided");

  const close = async (status: WriteStatus, payload: Row["payload"], result: WriteResult): Promise<SetupWrite> => {
    const upd = await db.from("module_setup_writes").update({ status, payload, result, decided_by: ctx.actor, decided_at: new Date().toISOString() })
      .eq("id", writeId).eq("status", "proposed").select("*").maybeSingle();
    fail(upd.error);
    if (!upd.data) throw new Error("Already decided");
    return toWrite(upd.data as Row, null);
  };

  if (change.decision === "reject") return close("rejected", row.payload, { outcome: "rejected" });

  if (row.kind === "rule") {
    const base = row.payload as RulePayload;
    const mode = change.rule?.mode ?? base.mode;
    const limitVnd = change.rule ? change.rule.limitVnd : base.limitVnd;
    const have = await ruleInForce(db, ctx.ws, base.action);
    const rule = await saveRuleCore(ctx, {
      department: moduleKey, action: base.action, mode, limit_vnd: actionDef(base.action).amountLimit ? limitVnd : null, required_fields: have.requiredFields,
    });
    await logEvidence(ctx.db, ctx.ws, {
      kind: "authority.rule_updated", actor: ctx.actor,
      summary: `${moduleKey}.${base.action} → ${mode}${rule.limit_vnd !== null ? ` < ${rule.limit_vnd}` : ""} (${moduleName(moduleKey, locale)} setup chat)`,
    });
    return close("applied", { ...base, mode, limitVnd: rule.limit_vnd }, { outcome: "applied", ruleId: rule.id });
  }

  const base = row.payload as FactPayload;
  const edit = change.fact;
  const value = (edit?.value ?? base.value).trim();
  const scope = edit?.scope && SCOPES.includes(edit.scope) ? edit.scope : base.scope;
  const subjectLabel = (edit?.subjectLabel ?? base.subjectLabel).trim();
  const baseAttribute = (edit?.attributeLabel ?? base.attributeLabel).trim();
  if (!value || !subjectLabel || !baseAttribute) throw new Error("A fact needs a subject, an attribute and a value.");

  const scopeId = change.onlyThisAgent && instance?.isMulti ? instance.id : null;
  const current = await factInForce(ctx.ws, { subjectLabel, attributeLabel: baseAttribute }, scopeId);
  const conflict = current !== null && !sameValue(current.value, value);
  let resolution: Resolution | undefined;
  if (conflict) {
    resolution = change.resolution;
    if (!resolution) throw new Error("Choose what to do with the value already in the Second Brain.");
  }
  const edited: FactPayload = { ...base, subjectLabel, attributeLabel: baseAttribute, value, scope };
  if (resolution === "keep") return close("rejected", edited, { outcome: "kept_current", resolution });

  let attributeLabel = baseAttribute;
  if (resolution === "both") {
    const situation = (change.situation ?? "").trim();
    if (!situation) throw new Error("Name the situation the new value is for.");
    attributeLabel = `${baseAttribute} (${situation})`.slice(0, 120);
  }

  const { data: msg } = row.source_message_id
    ? await db.from("module_setup_messages").select("body").eq("id", row.source_message_id).maybeSingle()
    : { data: null };
  const evidence: Evidence = {
    kind: "message", ref: row.source_message_id ?? `setup:${row.setup_session_id}`, label: `${moduleName(moduleKey, locale)} · setup chat (${row.gate_key})`,
    quote: typeof msg?.body === "string" ? msg.body.slice(0, 300) : undefined, at: new Date().toISOString(),
  };
  const { fact, outcome } = await proposeFact(supabaseAdmin(), ctx.ws, {
    subjectType: base.subjectType, subjectLabel, attributeLabel, value, scope, modules: scope === "restricted" ? [moduleKey] : [],
    sourceKind: "owner", proposedBy: ctx.actor, evidence: [evidence], installationId: scopeId,
  });
  if (fact.status !== "active") throw new Error("The Second Brain kept this value for review instead of applying it.");
  if (base.gapId) await markGapAnswered(ctx.ws, base.gapId, `fact:${fact.id}`);
  await enqueueWorkspaceSync(ctx.ws);
  return close("applied", { ...edited, attributeLabel }, { outcome, factId: fact.id, ...(resolution ? { resolution } : {}) });
};
