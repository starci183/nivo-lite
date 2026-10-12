import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  AUTO_APPLY_TRUST, TRUST, inForce, keyOf, numberOf, sameValue, visibleTo,
  type Audience, type Evidence, type Fact, type FactStatus, type ProposalKind, type Scope, type SourceKind, type SubjectType,
} from "./shared"
import { resolveGapsForFact } from "./gaps"

/**
 * Facts of the shared brain (server side). Every function takes the database client and the workspace id, so the same code runs from a
 * server action, an engine job or a check script. Rules:
 *  - exactly one ACTIVE fact per (subject, attribute) per scope; applying a new value supersedes the old one, which is kept as history.
 *    The scope is the whole type (installation_id null, the default: every instance reads it) or ONE agent instance (installation_id set:
 *    the opening hours of the Q1 branch's Chatbot), so a shared value and each instance's own value coexist;
 *  - the same value again only adds evidence (no duplicate rows);
 *  - a different value from a source below AUTO_APPLY_TRUST becomes a PROPOSAL that names the fact it disagrees with;
 *  - nothing is ever deleted: a wrong fact is rejected or retired.
 */

type Db = SupabaseClient

type Row = {
  id: string; subject_type: SubjectType; subject_key: string; subject_label: string; attribute: string; attribute_label: string
  value: string; value_number: number | string | null; unit: string | null; scope: Scope; modules: Array<string> | null; status: FactStatus
  source_kind: SourceKind; trust: number; valid_from: string | null; valid_to: string | null; supersedes_id: string | null
  conflict_with: string | null; proposal_kind: ProposalKind | null; evidence: Array<Evidence> | null; proposed_by: string; proposed_at: string; decided_by: string | null
  decided_at: string | null; decision_note: string | null; installation_id?: string | null
}

export const toFact = (r: Row): Fact => ({
  id: r.id, subjectType: r.subject_type, subjectKey: r.subject_key, subjectLabel: r.subject_label, attribute: r.attribute,
  attributeLabel: r.attribute_label, value: r.value, valueNumber: r.value_number === null ? null : Number(r.value_number), unit: r.unit,
  scope: r.scope, modules: r.modules ?? [], status: r.status, sourceKind: r.source_kind, trust: r.trust, validFrom: r.valid_from,
  validTo: r.valid_to, supersedesId: r.supersedes_id, conflictWith: r.conflict_with, proposalKind: r.proposal_kind ?? "set", evidence: r.evidence ?? [], proposedBy: r.proposed_by,
  proposedAt: r.proposed_at, decidedBy: r.decided_by, decidedAt: r.decided_at, decisionNote: r.decision_note, installationId: r.installation_id ?? null,
})

/** Narrow a query to one fact scope: the shared value (installation_id null) or one instance's own value. */
const inScope = <Q extends { eq: (c: string, v: string) => Q; is: (c: string, v: null) => Q }>(q: Q, installationId: string | null): Q =>
  installationId ? q.eq("installation_id", installationId) : q.is("installation_id", null)

const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message) }
const now = () => new Date().toISOString()
const EVIDENCE_MAX = 20

export type FactInput = {
  readonly subjectType?: SubjectType
  readonly subjectLabel: string
  readonly attributeLabel: string
  readonly value: string
  readonly unit?: string | null
  readonly scope?: Scope
  readonly modules?: ReadonlyArray<string>
  readonly sourceKind: SourceKind
  readonly validFrom?: string | null
  readonly validTo?: string | null
  readonly evidence?: ReadonlyArray<Evidence>
  readonly proposedBy: string
  /** Restrict the fact to ONE agent instance (one branch's Chatbot); omitted or null = shared by every instance (the default). */
  readonly installationId?: string | null
  /** Force the review path (false) or the direct path (true); default: direct only from a trusted source. */
  readonly autoApply?: boolean
}

export type ProposeOutcome = "applied" | "proposed" | "conflict" | "reinforced"

const mergeEvidence = (have: ReadonlyArray<Evidence>, add: ReadonlyArray<Evidence>): Array<Evidence> => {
  const seen = new Set(have.map((e) => `${e.kind}:${e.ref}`))
  return [...have, ...add.filter((e) => !seen.has(`${e.kind}:${e.ref}`))].slice(-EVIDENCE_MAX)
}

export const byKey = async (db: Db, ws: string, subjectKey: string, attribute: string, status: FactStatus, installationId: string | null = null): Promise<Array<Fact>> => {
  const { data, error } = await inScope(db.from("brain_facts").select("*").eq("workspace_id", ws).eq("subject_key", subjectKey).eq("attribute", attribute).eq("status", status), installationId)
  fail(error)
  return ((data ?? []) as Array<Row>).map(toFact)
}

export const getFact = async (db: Db, ws: string, id: string): Promise<Fact | null> => {
  const { data, error } = await db.from("brain_facts").select("*").eq("workspace_id", ws).eq("id", id).maybeSingle()
  fail(error)
  return data ? toFact(data as Row) : null
}

/**
 * Record what a source says. Same value as the active fact: its evidence grows (and its trust, if this source is more trusted).
 * Same value as a waiting proposal: that proposal's evidence grows. Otherwise a new row: applied at once from a trusted source (or when
 * `autoApply`), else a proposal that names the active fact it would replace (`conflict_with`).
 */
export const proposeFact = async (db: Db, ws: string, input: FactInput): Promise<{ fact: Fact; outcome: ProposeOutcome }> => {
  const subjectLabel = input.subjectLabel.trim().slice(0, 160)
  const attributeLabel = input.attributeLabel.trim().slice(0, 120)
  const value = input.value.trim().slice(0, 2000)
  const subjectKey = keyOf(subjectLabel)
  const attribute = keyOf(attributeLabel)
  if (!subjectKey || !attribute || !value) throw new Error("A fact needs a subject, an attribute and a value.")
  const trust = TRUST[input.sourceKind]
  const evidence = input.evidence ?? []
  const scopeId = input.installationId ?? null

  const [active] = await byKey(db, ws, subjectKey, attribute, "active", scopeId)
  if (active && sameValue(active.value, value)) {
    const { data, error } = await db.from("brain_facts")
      .update({ evidence: mergeEvidence(active.evidence, evidence), trust: Math.max(active.trust, trust), updated_at: now() })
      .eq("id", active.id).select("*").single()
    fail(error)
    // A source confirms the value again: a waiting proposal to stop using it no longer holds.
    if (evidence.length) {
      fail((await inScope(db.from("brain_facts").update({ status: "rejected", decision_note: "Có nguồn xác nhận lại giá trị này", decided_at: now(), updated_at: now() })
        .eq("workspace_id", ws).eq("subject_key", subjectKey).eq("attribute", attribute).eq("status", "proposed").eq("proposal_kind", "retire"), scopeId)).error)
    }
    return { fact: toFact(data as Row), outcome: "reinforced" }
  }
  const waiting = (await byKey(db, ws, subjectKey, attribute, "proposed", scopeId)).find((p) => p.proposalKind === "set" && sameValue(p.value, value))
  if (waiting) {
    const { data, error } = await db.from("brain_facts")
      .update({ evidence: mergeEvidence(waiting.evidence, evidence), trust: Math.max(waiting.trust, trust), updated_at: now() })
      .eq("id", waiting.id).select("*").single()
    fail(error)
    const fact = toFact(data as Row)
    if (input.autoApply ?? trust >= AUTO_APPLY_TRUST) return { fact: await applyFact(db, ws, fact.id, input.proposedBy), outcome: "applied" }
    return { fact, outcome: active ? "conflict" : "proposed" }
  }

  // A new value for a known fact keeps that fact's kind and audience unless the caller says otherwise: a staff member correcting a
  // public price must not quietly turn it internal (the chatbot would lose it).
  const scope = input.scope ?? active?.scope ?? "internal"
  const modules = scope === "restricted" ? [...(input.modules ?? active?.modules ?? [])] : []
  const { data, error } = await db.from("brain_facts").insert({
    workspace_id: ws, subject_type: input.subjectType ?? active?.subjectType ?? "business", subject_key: subjectKey, subject_label: subjectLabel, attribute,
    attribute_label: attributeLabel, value, value_number: numberOf(value), unit: input.unit?.trim() || active?.unit || null, scope,
    modules, status: "proposed", source_kind: input.sourceKind, trust,
    valid_from: input.validFrom ?? null, valid_to: input.validTo ?? null, conflict_with: active?.id ?? null, evidence, proposed_by: input.proposedBy,
    installation_id: scopeId,
  }).select("*").single()
  fail(error)
  const fact = toFact(data as Row)
  if (input.autoApply ?? trust >= AUTO_APPLY_TRUST) return { fact: await applyFact(db, ws, fact.id, input.proposedBy), outcome: "applied" }
  return { fact, outcome: active ? "conflict" : "proposed" }
}

/**
 * Approve a proposal. Valid from now (or no date): it becomes the active fact and the current active one is superseded and closed now.
 * Valid from a later date: it is SCHEDULED, and the current value stays in force until that moment (its valid_to is set to it);
 * promoteDue makes the switch when the time comes.
 */
export const applyFact = async (db: Db, ws: string, id: string, decidedBy: string, note?: string): Promise<Fact> => {
  const fact = await getFact(db, ws, id)
  if (!fact) throw new Error("Fact not found.")
  if (fact.status !== "proposed") throw new Error("Only a proposed fact can be applied.")
  const [current] = await byKey(db, ws, fact.subjectKey, fact.attribute, "active", fact.installationId)
  const at = now()
  if (fact.proposalKind === "retire") {
    // Applying a retire proposal stops the active fact it points at; the proposal itself is closed as "expired" with the reason.
    if (current) await retireFact(db, ws, current.id, decidedBy, note?.trim() || "Không còn nguồn nào xác nhận giá trị này")
    const { data, error } = await db.from("brain_facts").update({
      status: "expired", decided_by: decidedBy, decided_at: at, decision_note: note?.trim() || "Đã ngừng dùng", updated_at: at,
    }).eq("id", id).eq("status", "proposed").select("*").single()
    fail(error)
    return toFact(data as Row)
  }
  if (fact.validFrom && Date.parse(fact.validFrom) > Date.now()) {
    // Only one scheduled change per fact: a newer approval replaces an older plan.
    fail((await inScope(db.from("brain_facts").update({ status: "rejected", decision_note: "Thay bằng lịch mới", updated_at: at })
      .eq("workspace_id", ws).eq("subject_key", fact.subjectKey).eq("attribute", fact.attribute).eq("status", "scheduled"), fact.installationId)).error)
    if (current) fail((await db.from("brain_facts").update({ valid_to: fact.validFrom, updated_at: at }).eq("id", current.id).eq("status", "active")).error)
    const { data, error } = await db.from("brain_facts").update({
      status: "scheduled", supersedes_id: current?.id ?? null, conflict_with: null, decided_by: decidedBy, decided_at: at, decision_note: note?.trim() || null, updated_at: at,
    }).eq("id", id).eq("status", "proposed").select("*").single()
    fail(error)
    return toFact(data as Row)
  }
  if (current) {
    fail((await db.from("brain_facts").update({ status: "superseded", valid_to: current.validTo ?? at, updated_at: at }).eq("id", current.id).eq("status", "active")).error)
  }
  const { data, error } = await db.from("brain_facts").update({
    status: "active", supersedes_id: current?.id ?? null, conflict_with: null, decided_by: decidedBy, decided_at: at,
    decision_note: note?.trim() || null, valid_from: fact.validFrom ?? at, updated_at: at,
  }).eq("id", id).eq("status", "proposed").select("*").single()
  fail(error)
  const applied = toFact(data as Row)
  // A fact customers may read can answer a question they asked that the brain could not (knowledge gaps).
  await resolveGapsForFact(db, ws, applied)
  return applied
}

/**
 * Choose one of several competing proposals for the same subject + attribute: it is applied (exactly as applyFact does) and every other
 * proposal waiting for that key is rejected with a note naming the chosen value. Used by the conflict card.
 */
export const chooseFact = async (db: Db, ws: string, id: string, decidedBy: string): Promise<Fact> => {
  const winner = await getFact(db, ws, id)
  if (!winner || winner.status !== "proposed" || winner.proposalKind !== "set") throw new Error("Only a proposed value can be chosen.")
  const fact = await applyFact(db, ws, id, decidedBy, "Được chọn khi có nhiều giá trị khác nhau")
  for (const other of await byKey(db, ws, winner.subjectKey, winner.attribute, "proposed", winner.installationId)) {
    if (other.id === id) continue
    await rejectFact(db, ws, other.id, decidedBy, other.proposalKind === "retire" ? "Đã chọn giá trị mới" : `Đã chọn giá trị khác: ${winner.value}`)
  }
  return fact
}

/** Keep the value in force: every proposal waiting for that subject + attribute is rejected. Returns how many. */
export const keepCurrent = async (db: Db, ws: string, subjectKey: string, attribute: string, decidedBy: string, installationId: string | null = null): Promise<number> => {
  const waiting = await byKey(db, ws, subjectKey, attribute, "proposed", installationId)
  for (const p of waiting) await rejectFact(db, ws, p.id, decidedBy, "Giữ giá trị đang dùng")
  return waiting.length
}

/**
 * Propose to stop using an active fact (its only evidence was a document that changed or was deleted). Nothing is retired silently:
 * the owner decides. One waiting proposal per fact.
 */
export const proposeRetire = async (db: Db, ws: string, active: Fact, why: Evidence, proposedBy: string): Promise<boolean> => {
  const waiting = (await byKey(db, ws, active.subjectKey, active.attribute, "proposed", active.installationId)).find((p) => p.proposalKind === "retire")
  if (waiting) return false
  const { error } = await db.from("brain_facts").insert({
    workspace_id: ws, subject_type: active.subjectType, subject_key: active.subjectKey, subject_label: active.subjectLabel, attribute: active.attribute,
    attribute_label: active.attributeLabel, value: active.value, value_number: active.valueNumber, unit: active.unit, scope: active.scope, modules: [...active.modules],
    status: "proposed", source_kind: "document", trust: TRUST.document, conflict_with: active.id, proposal_kind: "retire", evidence: [why], proposed_by: proposedBy,
    installation_id: active.installationId,
  })
  fail(error)
  return true
}

/** Turn a proposal down; it stays in the history with the reason. */
export const rejectFact = async (db: Db, ws: string, id: string, decidedBy: string, note?: string): Promise<Fact> => {
  const { data, error } = await db.from("brain_facts")
    .update({ status: "rejected", decided_by: decidedBy, decided_at: now(), decision_note: note?.trim() || null, updated_at: now() })
    .eq("workspace_id", ws).eq("id", id).eq("status", "proposed").select("*").maybeSingle()
  fail(error)
  if (!data) throw new Error("Only a proposed fact can be rejected.")
  return toFact(data as Row)
}

/** Stop an active fact without a replacement (no longer true): it expires now. */
export const retireFact = async (db: Db, ws: string, id: string, decidedBy: string, note?: string): Promise<Fact> => {
  const at = now()
  const { data, error } = await db.from("brain_facts")
    .update({ status: "expired", valid_to: at, decided_by: decidedBy, decided_at: at, decision_note: note?.trim() || null, updated_at: at })
    .eq("workspace_id", ws).eq("id", id).eq("status", "active").select("*").maybeSingle()
  fail(error)
  if (!data) throw new Error("Only an active fact can be retired.")
  return toFact(data as Row)
}

/** Scheduled facts whose time has come take over: the fact they replace is superseded, they become active. Returns how many. */
export const promoteDue = async (db: Db, ws: string): Promise<number> => {
  const { data, error } = await db.from("brain_facts").select("*").eq("workspace_id", ws).eq("status", "scheduled").lte("valid_from", now())
  fail(error)
  let n = 0
  for (const f of ((data ?? []) as Array<Row>).map(toFact)) {
    const at = now()
    for (const old of await byKey(db, ws, f.subjectKey, f.attribute, "active", f.installationId)) {
      fail((await db.from("brain_facts").update({ status: "superseded", valid_to: old.validTo ?? at, updated_at: at }).eq("id", old.id).eq("status", "active")).error)
    }
    fail((await db.from("brain_facts").update({ status: "active", updated_at: at }).eq("id", f.id).eq("status", "scheduled")).error)
    await resolveGapsForFact(db, ws, { ...f, status: "active" })
    n += 1
  }
  return n
}

/** Keep the brain current before it is read: scheduled values take over, ended values expire. Best effort (a read-only client skips it). */
export const maintain = async (db: Db, ws: string): Promise<void> => {
  try {
    await promoteDue(db, ws)
    await expireDue(db, ws)
  } catch (e) {
    console.error("brain maintain skipped:", e instanceof Error ? e.message : e)
  }
}

/** Active facts whose validity ended become expired (run on a tick or before a read). Returns how many. */
export const expireDue = async (db: Db, ws: string): Promise<number> => {
  const { data, error } = await db.from("brain_facts").update({ status: "expired", updated_at: now() })
    .eq("workspace_id", ws).eq("status", "active").lt("valid_to", now()).select("id")
  fail(error)
  return (data ?? []).length
}

export type FactFilter = { readonly status?: FactStatus | ReadonlyArray<FactStatus>; readonly subjectKey?: string; readonly limit?: number }

export const listFacts = async (db: Db, ws: string, filter: FactFilter = {}): Promise<Array<Fact>> => {
  let q = db.from("brain_facts").select("*").eq("workspace_id", ws)
  if (filter.status) q = Array.isArray(filter.status) ? q.in("status", filter.status as Array<string>) : q.eq("status", filter.status as string)
  if (filter.subjectKey) q = q.eq("subject_key", filter.subjectKey)
  const { data, error } = await q.order("updated_at", { ascending: false }).limit(Math.min(filter.limit ?? 500, 2000))
  fail(error)
  return ((data ?? []) as Array<Row>).map(toFact)
}

/** The facts one agent may use right now: active, in force, inside its view. Newest first. */
/** The active facts an agent sees: its audience and module (visibleTo) and, for an instance, the shared facts plus that instance's own. */
export const factsForView = async (db: Db, ws: string, audience: Audience, module: string, limit = 500, installationId: string | null = null): Promise<Array<Fact>> => {
  await maintain(db, ws)
  return (await listFacts(db, ws, { status: "active", limit })).filter((f) => inForce(f) && visibleTo(f, audience, module, installationId))
}

/**
 * The facts in a view that match a question, best first: every word of the question (accents ignored) counts once when it appears in
 * the subject, the attribute or the value; the subject counts double. Small workspaces keep a few hundred facts, so this runs in memory.
 */
export const searchFacts = (facts: ReadonlyArray<Fact>, query: string, limit = 8): Array<Fact> => {
  const words = [...new Set(keyOf(query).split("-").filter((w) => w.length > 1))]
  if (!words.length) return []
  return facts
    .map((f) => {
      const subject = `-${f.subjectKey}-`
      const rest = `-${f.attribute}-${keyOf(f.value)}-`
      const score = words.reduce((s, w) => s + (subject.includes(`-${w}-`) ? 2 : 0) + (rest.includes(`-${w}-`) ? 1 : 0), 0)
      return { f, score }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.f.trust - a.f.trust)
    .slice(0, limit)
    .map((x) => x.f)
}

/**
 * Resolve a disagreement by keeping both values: the proposal becomes its own fact for the situation it names ("Giá (cuối tuần)"),
 * applied at once, and the proposal itself is closed with that note. The current value is untouched.
 */
export const splitFact = async (db: Db, ws: string, id: string, situation: string, decidedBy: string): Promise<Fact> => {
  const p = await getFact(db, ws, id)
  if (!p || p.status !== "proposed" || p.proposalKind !== "set") throw new Error("Only a proposed fact can be split.")
  const label = situation.trim()
  if (!label) throw new Error("Name the situation the new value is for.")
  const { fact } = await proposeFact(db, ws, {
    subjectType: p.subjectType, subjectLabel: p.subjectLabel, attributeLabel: `${p.attributeLabel} (${label})`, value: p.value, unit: p.unit,
    scope: p.scope, modules: p.modules, sourceKind: p.sourceKind, validFrom: p.validFrom, validTo: p.validTo, evidence: p.evidence,
    proposedBy: p.proposedBy, autoApply: true,
  })
  await rejectFact(db, ws, id, decidedBy, `Tách thành sự thật riêng: ${p.attributeLabel} (${label})`)
  return fact
}
