import "server-only"
import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { generateText } from "../automation-llm"
import { supabaseAdmin } from "../supabase/admin"
import { blockedBy, withUsage } from "../usage"
import { byKey, getFact, proposeFact, proposeRetire, rejectFact, toFact } from "./facts"
import { MAX_FACTS_PER_DOC, PROMPT_VERSION, SYSTEM_PROMPT, parseFacts, userPrompt, windowsOf } from "./doc-parse"
import type { Evidence, ExtractionInfo, ExtractionStatus } from "./shared"

/**
 * Facts out of documents, PARTIALLY: when one document becomes ready only THAT document is read; when it changes or is deleted only what
 * it contributed is withdrawn and re-read. Why this beats rebuilding the whole graph on every update:
 *  - cost is proportional to the change (one document of N, not N documents), so a typo fix in a price list never re-bills the archive;
 *  - the founder's decisions are kept: applied facts stay applied, rejected proposals stay rejected, and nothing the owner approved is
 *    thrown away and re-asked;
 *  - values do not reshuffle: a fact is not re-derived by a model that may word it differently today, so the brain does not drift
 *    between rebuilds and every agent keeps answering from the same facts;
 *  - conflicts surface exactly where the new document disagrees: its facts arrive as proposals next to the value in force (or next to
 *    another document's proposal), instead of being lost in a sea of regenerated rows.
 * A FULL rebuild happens in exactly one case: EXTRACTION prompt_version changed (doc-parse.ts PROMPT_VERSION). Then every document is queued
 * again and re-read in small background batches, never as part of an update.
 *
 * Where it runs: indexing a document (request) only QUEUES it (brain_extractions row, status queued). The reading happens after the response
 * (`after()`), and is resumable: a document is read in windows, `windows_done` is saved after each one, and any later page load of /brain or
 * /knowledge (drainBrainWork) picks up what is still queued. A document that is not changed is never read twice (content_hash + prompt_version).
 * Every model call is OpenClaw through generateText, opened under withUsage({ kind: "brain" }) so the workspace's credits pay for it, and
 * blockedBy(workspace, "brain") is asked before each call: with no credits the record becomes blocked_credits and nothing runs.
 */

type Db = SupabaseClient
type FactRow = Parameters<typeof toFact>[0]

type Rec = {
  source_id: string; workspace_id: string; status: ExtractionStatus; facts_proposed: number; error: string | null; model: string | null
  prompt_version: number; content_hash: string | null; windows_total: number; windows_done: number; attempts: number; orphan_fact_ids: Array<string>; updated_at: string
}

type SourceRow = { id: string; workspace_id: string; title: string; content: string; visibility: "public" | "internal"; status: string; updated_at: string; installation_id: string | null }

const BY = "NIVO"
const MAX_ATTEMPTS = 3
const RETRY_AFTER_MS = 2 * 60_000
const STALE_RUNNING_MS = 10 * 60_000
/** A drain reads at most this many documents and stops starting new windows after this long (a page load never waits for it: it runs after the response). */
const DRAIN_SOURCES = 5
const DRAIN_BUDGET_MS = 100_000
/** Documents queued per drain for the first reading of old documents or a prompt-version rebuild. */
const REBUILD_BATCH = 2

const iso = (ms = Date.now()): string => new Date(ms).toISOString()
const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message) }
const hashOf = (content: string): string => createHash("sha256").update(content).digest("hex").slice(0, 32)
const isFrom = (e: Evidence, sourceId: string): boolean => e.kind === "document" && e.ref === sourceId

/* ------------------------------------------------------------------ withdrawing what a document contributed */

/**
 * Take one document's contribution back: waiting proposals that rest on it alone are rejected with `note`; a proposal or fact that other
 * sources also support just loses this document from its evidence. Returns the ids of ACTIVE document facts left with no evidence at all
 * (they are not retired here: see finalizeOrphans).
 */
export const withdrawSource = async (db: Db, ws: string, sourceId: string, note: string): Promise<Array<string>> => {
  const { data, error } = await db.from("brain_facts").select("*").eq("workspace_id", ws).in("status", ["proposed", "scheduled", "active"])
    .contains("evidence", [{ kind: "document", ref: sourceId }])
  fail(error)
  const orphans: Array<string> = []
  for (const row of (data ?? []) as Array<FactRow>) {
    const f = toFact(row)
    const rest = f.evidence.filter((e) => !isFrom(e, sourceId))
    if (f.status === "proposed" && rest.length === 0) {
      await rejectFact(db, ws, f.id, BY, note)
      continue
    }
    fail((await db.from("brain_facts").update({ evidence: rest, updated_at: iso() }).eq("id", f.id)).error)
    if (f.status === "active" && rest.length === 0 && f.sourceKind === "document") orphans.push(f.id)
  }
  return orphans
}

/**
 * An active fact whose only evidence was the document is not deleted: a proposal to stop using it is filed for the owner. Skipped when the
 * fact got evidence again (the new reading confirmed it) or when a competing value is already waiting (choosing it supersedes the old one).
 */
const finalizeOrphans = async (db: Db, ws: string, ids: ReadonlyArray<string>, why: Evidence): Promise<number> => {
  let n = 0
  for (const id of ids) {
    const f = await getFact(db, ws, id)
    if (!f || f.status !== "active" || f.evidence.length > 0) continue
    const waiting = await byKey(db, ws, f.subjectKey, f.attribute, "proposed", f.installationId)
    if (waiting.some((p) => p.proposalKind === "set")) continue
    if (await proposeRetire(db, ws, f, why, BY)) n += 1
  }
  return n
}

const goneEvidence = (sourceId: string, title: string, verb: string): Evidence => ({
  kind: "note", ref: `gone:${sourceId}`, label: `Tài liệu "${title}" ${verb}: không còn nguồn nào xác nhận giá trị này`, at: iso(),
})

/** A document is being deleted: withdraw what it contributed now (nothing will re-read it). Never throws. */
export const onSourceDeleted = async (ws: string, sourceId: string, title: string): Promise<void> => {
  try {
    const db = supabaseAdmin()
    const orphans = await withdrawSource(db, ws, sourceId, "source changed")
    await finalizeOrphans(db, ws, orphans, goneEvidence(sourceId, title, "đã bị xóa"))
  } catch (e) {
    console.error("brain: withdrawing a deleted document failed:", e instanceof Error ? e.message : String(e))
  }
}

/* ------------------------------------------------------------------ queueing */

const getRec = async (db: Db, sourceId: string): Promise<Rec | null> => {
  const { data, error } = await db.from("brain_extractions").select("*").eq("source_id", sourceId).maybeSingle()
  fail(error)
  return (data as Rec | null) ?? null
}

/**
 * A document is ready (or was re-indexed): queue its reading. The same text read with the same prompt version is never queued twice. A changed
 * text (or a new prompt version) first withdraws what the document contributed before, then queues a fresh reading. Cheap: no model call.
 */
export const queueExtraction = async (ws: string, src: { readonly id: string; readonly content: string }): Promise<void> => {
  const db = supabaseAdmin()
  const hash = hashOf(src.content)
  const rec = await getRec(db, src.id)
  if (rec && rec.content_hash === hash && rec.prompt_version === PROMPT_VERSION) {
    if (rec.status === "failed") fail((await db.from("brain_extractions").update({ status: "queued", attempts: 0, error: null, updated_at: iso() }).eq("source_id", src.id)).error)
    return
  }
  const orphans = rec ? await withdrawSource(db, ws, src.id, "source changed") : []
  fail((await db.from("brain_extractions").upsert({
    source_id: src.id, workspace_id: ws, status: "queued", facts_proposed: 0, error: null, model: null, prompt_version: PROMPT_VERSION, content_hash: hash,
    windows_total: windowsOf(src.content).length, windows_done: 0, attempts: 0, orphan_fact_ids: [...new Set([...(rec?.orphan_fact_ids ?? []), ...orphans])], updated_at: iso(),
  }, { onConflict: "source_id" })).error)
}

/** What the UI shows per document. */
export const extractionsOf = async (ws: string, sourceIds?: ReadonlyArray<string>): Promise<Array<ExtractionInfo>> => {
  let q = supabaseAdmin().from("brain_extractions").select("source_id, status, facts_proposed, error").eq("workspace_id", ws)
  if (sourceIds) q = q.in("source_id", [...sourceIds])
  const { data, error } = await q
  fail(error)
  return ((data ?? []) as Array<{ source_id: string; status: ExtractionStatus; facts_proposed: number; error: string | null }>)
    .map((r) => ({ sourceId: r.source_id, status: r.status, factsProposed: r.facts_proposed, error: r.error }))
}

/* ------------------------------------------------------------------ reading */

const claim = async (db: Db, sourceId: string): Promise<Rec | null> => {
  const first = await db.from("brain_extractions").update({ status: "running", updated_at: iso() }).eq("source_id", sourceId).in("status", ["queued", "blocked_credits"]).select("*").maybeSingle()
  fail(first.error)
  if (first.data) return first.data as Rec
  const stale = await db.from("brain_extractions").update({ status: "running", updated_at: iso() }).eq("source_id", sourceId).eq("status", "running").lt("updated_at", iso(Date.now() - STALE_RUNNING_MS)).select("*").maybeSingle()
  fail(stale.error)
  return (stale.data as Rec | null) ?? null
}

const save = async (db: Db, sourceId: string, patch: Partial<Omit<Rec, "source_id" | "workspace_id">>): Promise<void> => {
  fail((await db.from("brain_extractions").update({ ...patch, updated_at: iso() }).eq("source_id", sourceId)).error)
}

/**
 * Read one queued document, window by window, filing every valid fact as a PROPOSAL (document trust 75 is below auto-apply, so the owner
 * reviews them). Stops without losing progress when the time budget ends (back to queued) or the credits run out (blocked_credits).
 */
export const runExtraction = async (ws: string, sourceId: string, until: number): Promise<void> => {
  const db = supabaseAdmin()
  const rec = await claim(db, sourceId)
  if (!rec) return
  try {
    const { data } = await db.from("knowledge_sources").select("id, workspace_id, title, content, visibility, status, updated_at, installation_id").eq("id", sourceId).eq("workspace_id", ws).maybeSingle()
    const src = data as SourceRow | null
    if (!src) return
    if (src.status !== "ready") return void (await save(db, sourceId, { status: "queued" }))
    const windows = windowsOf(src.content)
    let { windows_done: done, facts_proposed: filed } = rec
    const hash = hashOf(src.content)
    if (hash !== rec.content_hash) {
      done = 0
      filed = 0
      await save(db, sourceId, { content_hash: hash, windows_done: 0, facts_proposed: 0 })
    }
    await save(db, sourceId, { windows_total: windows.length })

    while (done < windows.length && filed < MAX_FACTS_PER_DOC) {
      if (Date.now() > until) return void (await save(db, sourceId, { status: "queued", windows_done: done, facts_proposed: filed }))
      const cur = await getRec(db, sourceId)
      if (!cur || cur.content_hash !== hash || cur.prompt_version !== rec.prompt_version) return // the document changed meanwhile: its new reading is queued
      if (await blockedBy(ws, "brain")) return void (await save(db, sourceId, { status: "blocked_credits", windows_done: done, facts_proposed: filed, error: null }))

      const text = windows[done] as string
      const answer = await withUsage({ workspaceId: ws, kind: "brain", module: "knowledge" }, () =>
        generateText({ workspaceId: ws, purpose: "brain_facts", system: SYSTEM_PROMPT, prompt: userPrompt({ title: src.title, updatedAt: src.updated_at, index: done, total: windows.length, text }) }))
      const parsed = answer === null ? null : parseFacts(answer, text)
      if (!parsed || !parsed.valid) {
        const attempts = rec.attempts + 1
        rec.attempts = attempts
        const error = answer === null ? "NIVO đang bận, sẽ thử lại." : "Câu trả lời không đọc được, sẽ thử lại."
        return void (await save(db, sourceId, { status: attempts >= MAX_ATTEMPTS ? "failed" : "queued", attempts, error, windows_done: done, facts_proposed: filed }))
      }
      rec.attempts = 0
      const evidenceAt = src.updated_at
      for (const f of parsed.facts) {
        if (filed >= MAX_FACTS_PER_DOC) break
        try {
          await proposeFact(db, ws, {
            subjectType: f.subjectType, subjectLabel: f.subjectLabel, attributeLabel: f.attributeLabel, value: f.value, unit: f.unit,
            // Public only when the model says so AND the owner marked the document public; otherwise the fact keeps the audience of the fact it may replace, else internal.
            scope: f.scope === "public" && src.visibility === "public" ? "public" : undefined,
            sourceKind: "document", validFrom: f.validFrom, autoApply: false,
            // A document kept for one agent instance proposes facts for that instance only (null = shared, as before).
            installationId: src.installation_id, proposedBy: `Tài liệu: ${src.title.slice(0, 80)}`,
            evidence: [{ kind: "document", ref: src.id, label: src.title, quote: f.quote ?? undefined, at: evidenceAt, sourceId: src.id, title: src.title }],
          })
          filed += 1
        } catch (e) {
          console.error("brain: filing a fact failed:", e instanceof Error ? e.message : String(e))
        }
      }
      done += 1
      await save(db, sourceId, { status: "running", windows_done: done, facts_proposed: filed, attempts: 0, error: null })
    }

    await finalizeOrphans(db, ws, rec.orphan_fact_ids, goneEvidence(src.id, src.title, "đã đổi"))
    await save(db, sourceId, { status: "done", windows_done: done, facts_proposed: filed, orphan_fact_ids: [], error: null, model: "openclaw" })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error("brain: extraction failed:", message)
    await save(db, sourceId, { status: "failed", error: message.slice(0, 300) }).catch(() => undefined)
  }
}

/* ------------------------------------------------------------------ background work */

/**
 * Old documents never read, and (after a prompt_version bump) every document read with an older prompt, are queued a couple at a time.
 * Nothing here runs on an ordinary update: a changed document queues itself in queueExtraction.
 */
const enqueueMissing = async (db: Db, ws: string): Promise<void> => {
  const recs = await db.from("brain_extractions").select("source_id, prompt_version, status").eq("workspace_id", ws)
  fail(recs.error)
  const have = new Map(((recs.data ?? []) as Array<{ source_id: string; prompt_version: number; status: ExtractionStatus }>).map((r) => [r.source_id, r]))
  const srcs = await db.from("knowledge_sources").select("id").eq("workspace_id", ws).eq("status", "ready").order("created_at")
  fail(srcs.error)
  const todo = ((srcs.data ?? []) as Array<{ id: string }>).filter((s) => {
    const r = have.get(s.id)
    return !r || (r.prompt_version < PROMPT_VERSION && r.status !== "queued" && r.status !== "running")
  }).slice(0, REBUILD_BATCH)
  for (const s of todo) {
    const { data } = await db.from("knowledge_sources").select("id, content").eq("id", s.id).maybeSingle()
    if (data) await queueExtraction(ws, data as { id: string; content: string })
  }
}

const inflight = new Set<string>()

/**
 * Do the waiting brain work of a workspace, bounded: queue a couple of documents that were never read (or were read with an older prompt),
 * then read up to {@link DRAIN_SOURCES} queued documents within {@link DRAIN_BUDGET_MS}. With no credits nothing runs and the queued
 * documents are marked blocked_credits. Called after the response of /brain, /knowledge and of adding a document. Never throws.
 */
export const drainBrainWork = async (ws: string, opts: { readonly budgetMs?: number } = {}): Promise<void> => {
  if (inflight.has(ws)) return
  inflight.add(ws)
  try {
    const db = supabaseAdmin()
    if (await blockedBy(ws, "brain")) {
      fail((await db.from("brain_extractions").update({ status: "blocked_credits", updated_at: iso() }).eq("workspace_id", ws).eq("status", "queued")).error)
      return
    }
    await enqueueMissing(db, ws)
    const until = Date.now() + (opts.budgetMs ?? DRAIN_BUDGET_MS)
    const { data, error } = await db.from("brain_extractions").select("source_id, status, attempts, updated_at").eq("workspace_id", ws)
      .in("status", ["queued", "blocked_credits", "running"]).order("updated_at").limit(20)
    fail(error)
    const retryBefore = iso(Date.now() - RETRY_AFTER_MS)
    const staleBefore = iso(Date.now() - STALE_RUNNING_MS)
    const runnable = ((data ?? []) as Array<{ source_id: string; status: ExtractionStatus; attempts: number; updated_at: string }>)
      .filter((r) => (r.status === "running" ? r.updated_at < staleBefore : r.attempts === 0 || r.updated_at < retryBefore))
      .slice(0, DRAIN_SOURCES)
    for (const r of runnable) {
      if (Date.now() > until) break
      await runExtraction(ws, r.source_id, until)
    }
  } catch (e) {
    console.error("brain: background work failed:", e instanceof Error ? e.message : String(e))
  } finally {
    inflight.delete(ws)
  }
}
