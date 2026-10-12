// PORTED from src/lib/brain/doc-facts.ts (keep in sync by hand). The rules are the web's: a document is read window by window, every valid fact is
// filed as a PROPOSAL (document trust 75, never auto-applied), what a changed document contributed before is withdrawn first, active facts
// left without evidence get a retire proposal, progress (windows_done) is saved after every window, and the same text with the same prompt
// version is never read twice. What changed for the job runner:
//  - no claim / drain / time budget: the queue runs one knowledge.facts job per source at a time, and a retry resumes from windows_done;
//  - a model failure or an unreadable answer throws FactsRetry (the queue retries with its backoff) instead of re-queueing for the next page load;
//  - no credits throws FactsBlocked after saving the record as blocked_credits.
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { recordUsage, blockedBy } from "../usage";
import { byKey, getFact, proposeFact, proposeRetire, rejectFact, toFact } from "./facts";
import { MAX_FACTS_PER_DOC, PROMPT_VERSION, SYSTEM_PROMPT, parseFacts, userPrompt, windowsOf } from "./doc-parse";
import type { Evidence, ExtractionStatus } from "./shared";
import type { ModelAnswer } from "../../facts-model.service";

type Db = SupabaseClient;
type FactRow = Parameters<typeof toFact>[0];

type Rec = {
  source_id: string; workspace_id: string; status: ExtractionStatus; facts_proposed: number; error: string | null; model: string | null;
  prompt_version: number; content_hash: string | null; windows_total: number; windows_done: number; attempts: number; orphan_fact_ids: Array<string>; updated_at: string;
};

export type FactsSource = { readonly id: string; readonly title: string; readonly content: string; readonly visibility: "public" | "internal"; readonly updated_at: string };

const BY = "NIVO";

const iso = (ms = Date.now()): string => new Date(ms).toISOString();
const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message); };
export const hashOf = (content: string): string => createHash("sha256").update(content).digest("hex").slice(0, 32);
const isFrom = (e: Evidence, sourceId: string): boolean => e.kind === "document" && e.ref === sourceId;

/** The model failed or answered something unreadable: retry later (progress is saved). */
export class FactsRetry extends Error {}
/** The workspace has no credits left for brain work (record saved as blocked_credits). */
export class FactsBlocked extends Error {}

/* ------------------------------------------------------------------ withdrawing what a document contributed */

export const withdrawSource = async (db: Db, ws: string, sourceId: string, note: string): Promise<Array<string>> => {
  const { data, error } = await db.from("brain_facts").select("*").eq("workspace_id", ws).in("status", ["proposed", "scheduled", "active"])
    .contains("evidence", [{ kind: "document", ref: sourceId }]);
  fail(error);
  const orphans: Array<string> = [];
  for (const row of (data ?? []) as Array<FactRow>) {
    const f = toFact(row);
    const rest = f.evidence.filter((e) => !isFrom(e, sourceId));
    if (f.status === "proposed" && rest.length === 0) {
      await rejectFact(db, ws, f.id, BY, note);
      continue;
    }
    fail((await db.from("brain_facts").update({ evidence: rest, updated_at: iso() }).eq("id", f.id)).error);
    if (f.status === "active" && rest.length === 0 && f.sourceKind === "document") orphans.push(f.id);
  }
  return orphans;
};

const finalizeOrphans = async (db: Db, ws: string, ids: ReadonlyArray<string>, why: Evidence): Promise<number> => {
  let n = 0;
  for (const id of ids) {
    const f = await getFact(db, ws, id);
    if (!f || f.status !== "active" || f.evidence.length > 0) continue;
    const waiting = await byKey(db, ws, f.subjectKey, f.attribute, "proposed");
    if (waiting.some((p) => p.proposalKind === "set")) continue;
    if (await proposeRetire(db, ws, f, why, BY)) n += 1;
  }
  return n;
};

const goneEvidence = (sourceId: string, title: string, verb: string): Evidence => ({
  kind: "note", ref: `gone:${sourceId}`, label: `Tài liệu "${title}" ${verb}: không còn nguồn nào xác nhận giá trị này`, at: iso(),
});

/* ------------------------------------------------------------------ the record */

const getRec = async (db: Db, sourceId: string): Promise<Rec | null> => {
  const { data, error } = await db.from("brain_extractions").select("*").eq("source_id", sourceId).maybeSingle();
  fail(error);
  return (data as Rec | null) ?? null;
};

const save = async (db: Db, sourceId: string, patch: Partial<Omit<Rec, "source_id" | "workspace_id">>): Promise<void> => {
  fail((await db.from("brain_extractions").update({ ...patch, updated_at: iso() }).eq("source_id", sourceId)).error);
};

/**
 * queueExtraction of the web, run at the start of the job: the same text with the same prompt version keeps its record (and its progress); a
 * changed text or a new prompt version first withdraws what the document contributed, then starts a fresh reading. Returns the record to work on.
 */
const prepare = async (db: Db, ws: string, src: FactsSource): Promise<Rec> => {
  const hash = hashOf(src.content);
  const rec = await getRec(db, src.id);
  if (rec && rec.content_hash === hash && rec.prompt_version === PROMPT_VERSION) return rec;
  const orphans = rec ? await withdrawSource(db, ws, src.id, "source changed") : [];
  fail((await db.from("brain_extractions").upsert({
    source_id: src.id, workspace_id: ws, status: "queued", facts_proposed: 0, error: null, model: null, prompt_version: PROMPT_VERSION, content_hash: hash,
    windows_total: windowsOf(src.content).length, windows_done: 0, attempts: 0, orphan_fact_ids: [...new Set([...(rec?.orphan_fact_ids ?? []), ...orphans])], updated_at: iso(),
  }, { onConflict: "source_id" })).error);
  return (await getRec(db, src.id)) as Rec;
};

export type ExtractDeps = {
  readonly db: Db;
  readonly generate: (workspaceId: string, system: string, prompt: string) => Promise<ModelAnswer | null>;
  readonly onWindow?: (done: number, total: number) => Promise<void>;
};

export type ExtractOutcome = { readonly windows: number; readonly facts: number; readonly skipped: boolean };

/**
 * Read one document (runExtraction of the web). Every model call is metered as usage kind 'brain' / module 'knowledge' (what the web's
 * generateCallback records for a brain_facts generation), and blockedBy(workspace, 'brain') is asked before each one.
 */
export const extractDocument = async (d: ExtractDeps, ws: string, src: FactsSource): Promise<ExtractOutcome> => {
  const { db } = d;
  const rec = await prepare(db, ws, src);
  if (rec.status === "done") return { windows: rec.windows_done, facts: rec.facts_proposed, skipped: true };
  const windows = windowsOf(src.content);
  let { windows_done: done, facts_proposed: filed } = rec;
  await save(db, src.id, { status: "running", windows_total: windows.length });

  while (done < windows.length && filed < MAX_FACTS_PER_DOC) {
    if (await blockedBy(db, ws, "brain")) {
      await save(db, src.id, { status: "blocked_credits", windows_done: done, facts_proposed: filed, error: null });
      throw new FactsBlocked("no credits");
    }
    const text = windows[done] as string;
    const answer = await d.generate(ws, SYSTEM_PROMPT, userPrompt({ title: src.title, updatedAt: src.updated_at, index: done, total: windows.length, text }));
    if (answer) {
      await recordUsage(db, { workspaceId: ws, kind: "brain", module: "knowledge", model: answer.usage?.model ?? "engine", usage: answer.usage ?? undefined, completionChars: answer.text.length });
    }
    const parsed = answer === null ? null : parseFacts(answer.text, text);
    if (!parsed || !parsed.valid) {
      const attempts = rec.attempts + 1;
      rec.attempts = attempts;
      const error = answer === null ? "NIVO đang bận, sẽ thử lại." : "Câu trả lời không đọc được, sẽ thử lại.";
      await save(db, src.id, { status: "queued", attempts, error, windows_done: done, facts_proposed: filed });
      throw new FactsRetry(error);
    }
    rec.attempts = 0;
    for (const f of parsed.facts) {
      if (filed >= MAX_FACTS_PER_DOC) break;
      try {
        await proposeFact(db, ws, {
          subjectType: f.subjectType, subjectLabel: f.subjectLabel, attributeLabel: f.attributeLabel, value: f.value, unit: f.unit,
          scope: f.scope === "public" && src.visibility === "public" ? "public" : undefined,
          sourceKind: "document", validFrom: f.validFrom, autoApply: false, proposedBy: `Tài liệu: ${src.title.slice(0, 80)}`,
          evidence: [{ kind: "document", ref: src.id, label: src.title, quote: f.quote ?? undefined, at: src.updated_at, sourceId: src.id, title: src.title }],
        });
        filed += 1;
      } catch (e) {
        console.error("brain: filing a fact failed:", e instanceof Error ? e.message : String(e));
      }
    }
    done += 1;
    await save(db, src.id, { status: "running", windows_done: done, facts_proposed: filed, attempts: 0, error: null });
    await d.onWindow?.(done, windows.length);
  }

  await finalizeOrphans(db, ws, rec.orphan_fact_ids, goneEvidence(src.id, src.title, "đã đổi"));
  await save(db, src.id, { status: "done", windows_done: done, facts_proposed: filed, orphan_fact_ids: [], error: null, model: "openclaw" });
  return { windows: done, facts: filed, skipped: false };
};

/** The reading gave up for good (last retry): the record says so; the document itself stays usable. */
export const markExtractionFailed = async (db: Db, sourceId: string, message: string): Promise<void> => {
  await save(db, sourceId, { status: "failed", error: message.slice(0, 300) }).catch(() => undefined);
};
