import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { listLessons, proposeLesson } from "./lessons"
import type { Evidence } from "./shared"

/**
 * Self-learning, the reviewed way. The model never changes itself: what changes is the brain. The best signal NIVO already keeps is the
 * owner's own review of the agents' work (decisions: edited / rejected, with the proposal before and after). This module
 *  1. keeps every correction as a regression case (brain_eval_cases), so a later change can be checked against what the owner wanted;
 *  2. asks the model for RECURRING patterns across those corrections and files them as PROPOSED lessons, each citing its decisions.
 * Nothing reaches an agent until an owner or manager approves the lesson.
 */

type Db = SupabaseClient
export type LearnGenerate = (messages: ReadonlyArray<{ role: "system" | "user"; content: string }>) => Promise<{ ok: true; output: string } | { ok: false }>

type DecisionRow = {
  id: string; department: string; action: string; outcome: "edited" | "rejected"; note: string | null; created_at: string
  before: { summary?: string; draft?: string; fields?: Record<string, unknown> } | null
  after: { summary?: string; draft?: string; fields?: Record<string, unknown> } | null
}

export type Correction = { readonly decisionId: string; readonly action: string; readonly outcome: "edited" | "rejected"; readonly at: string; readonly text: string }

const MIN_CORRECTIONS = 3
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** What changed in one decision, as a short readable block (draft before/after, changed fields, the owner's note). */
const describe = (d: DecisionRow): string => {
  const lines: Array<string> = [`Action: ${d.action} · ${d.outcome}`]
  const b = d.before ?? {}
  const a = d.after ?? {}
  if (d.outcome === "edited" && b.draft && a.draft && b.draft !== a.draft) lines.push(`AI draft: ${clip(b.draft, 600)}`, `Owner's version: ${clip(a.draft, 600)}`)
  else if (b.draft) lines.push(`AI draft: ${clip(b.draft, 600)}`)
  const fields = new Set([...Object.keys(b.fields ?? {}), ...Object.keys(a.fields ?? {})])
  for (const k of fields) {
    const was = JSON.stringify((b.fields ?? {})[k] ?? null)
    const now = JSON.stringify((a.fields ?? {})[k] ?? null)
    if (was !== now) lines.push(`Field ${k}: ${clip(was, 120)} -> ${clip(now, 120)}`)
  }
  if (d.note) lines.push(`Owner's note: ${clip(d.note, 300)}`)
  return lines.join("\n")
}

/** The owner's corrections of one agent's work in the last `days` days (newest first). */
export const corrections = async (db: Db, ws: string, module: string, days = 90): Promise<Array<Correction & { raw: DecisionRow }>> => {
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const { data, error } = await db.from("decisions").select("id, department, action, outcome, note, created_at, before, after")
    .eq("workspace_id", ws).eq("department", module).in("outcome", ["edited", "rejected"]).gte("created_at", since)
    .order("created_at", { ascending: false }).limit(60)
  if (error) throw new Error(error.message)
  return ((data ?? []) as Array<DecisionRow>).map((d) => ({ decisionId: d.id, action: d.action, outcome: d.outcome, at: d.created_at, text: describe(d), raw: d }))
}

/** Keep each correction as a regression case once (origin_ref = decision id). Returns how many were new. */
export const keepAsCases = async (db: Db, ws: string, module: string, list: ReadonlyArray<Correction & { raw: DecisionRow }>): Promise<number> => {
  if (!list.length) return 0
  const refs = list.map((c) => `decision:${c.decisionId}`)
  const { data } = await db.from("brain_eval_cases").select("origin_ref").eq("workspace_id", ws).in("origin_ref", refs)
  const have = new Set(((data ?? []) as Array<{ origin_ref: string }>).map((r) => r.origin_ref))
  const rows = list.filter((c) => !have.has(`decision:${c.decisionId}`)).map((c) => ({
    workspace_id: ws, module, kind: "draft", origin_ref: `decision:${c.decisionId}`,
    input: { action: c.action, proposal: c.raw.before }, expected: { outcome: c.outcome, proposal: c.raw.after, note: c.raw.note },
  }))
  if (!rows.length) return 0
  const { error } = await db.from("brain_eval_cases").insert(rows)
  if (error) throw new Error(error.message)
  return rows.length
}

const SYSTEM = [
  "You study how a business owner corrects an AI assistant's work, to find lessons the assistant should follow next time.",
  "Only report a pattern that appears in at least TWO corrections. Ignore one-off changes and anything about a single customer.",
  "A lesson is a short instruction the assistant can follow, in Vietnamese, specific and testable (e.g. 'Luôn ghi số tài khoản OCB ở cuối tin nhắn đòi nợ').",
  "Do not repeat a lesson that already exists (EXISTING LESSONS).",
  'Reply with ONLY JSON: {"lessons": [{"title": string (max 12 words), "body": string (max 60 words), "applies_when": string (max 20 words), "decisions": string[] (the ids it is based on, at least 2)}]} with at most 5 lessons, or {"lessons": []}.',
].join("\n")

const parse = (raw: string): Array<{ title: string; body: string; applies_when: string; decisions: Array<string> }> => {
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start < 0 || end <= start) return []
  try {
    const v = JSON.parse(raw.slice(start, end + 1)) as { lessons?: Array<Record<string, unknown>> }
    return (v.lessons ?? []).flatMap((l) => (typeof l.title === "string" && typeof l.body === "string"
      ? [{ title: l.title, body: l.body, applies_when: typeof l.applies_when === "string" ? l.applies_when : "", decisions: Array.isArray(l.decisions) ? l.decisions.filter((x): x is string => typeof x === "string") : [] }]
      : []))
  } catch {
    return []
  }
}

export type MineResult = { readonly corrections: number; readonly newCases: number; readonly proposed: number; readonly reason?: "not_enough" | "model_unavailable" }

/** Turn one agent's recent corrections into regression cases and proposed lessons. */
export const mineLessons = async (db: Db, ws: string, module: string, generate: LearnGenerate): Promise<MineResult> => {
  const list = await corrections(db, ws, module)
  const newCases = await keepAsCases(db, ws, module, list)
  if (list.length < MIN_CORRECTIONS) return { corrections: list.length, newCases, proposed: 0, reason: "not_enough" }
  const existing = (await listLessons(db, ws, ["active", "proposed"])).filter((l) => l.module === module || l.module === null)
  const user = [
    `EXISTING LESSONS:\n${existing.map((l) => `- ${l.title}: ${l.body}`).join("\n") || "(none)"}`,
    `CORRECTIONS (newest first):\n${list.map((c) => `[${c.decisionId}]\n${c.text}`).join("\n\n")}`,
  ].join("\n\n")
  const r = await generate([{ role: "system", content: SYSTEM }, { role: "user", content: user }])
  if (!r.ok) return { corrections: list.length, newCases, proposed: 0, reason: "model_unavailable" }
  const known = new Set(list.map((c) => c.decisionId))
  let proposed = 0
  for (const l of parse(r.output)) {
    const ids = [...new Set(l.decisions)].filter((id) => known.has(id))
    if (ids.length < 2) continue // a lesson must stand on at least two real corrections
    const evidence: Array<Evidence> = ids.map((id) => {
      const c = list.find((x) => x.decisionId === id)
      return { kind: "decision", ref: id, label: c ? `${c.action} · ${c.outcome}` : id, at: c?.at }
    })
    await proposeLesson(db, ws, { module, title: l.title, body: l.body, appliesWhen: l.applies_when, origin: "edits", evidence, proposedBy: "NIVO" })
    proposed += 1
  }
  return { corrections: list.length, newCases, proposed }
}
