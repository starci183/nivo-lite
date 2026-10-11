import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { factsForView, searchFacts } from "./facts"
import { lessonsForModule } from "./lessons"
import { factLine, type Audience, type Fact, type Lesson } from "./shared"

/**
 * Recall: what one agent should know for one question, with a citation for every line.
 *  - [F] facts of the shared brain, inside the agent's view (public only for a customer-facing agent);
 *  - [D] rows of the data hub (data_records), only from connections the agent holds a grant on, matched on their title.
 * Numbers come from these rows as they are; the agent is told not to add them up from text.
 */

type Db = SupabaseClient

export type RecordHit = {
  readonly id: string
  readonly entity: string
  readonly title: string
  readonly occurredAt: string | null
  readonly data: Readonly<Record<string, unknown>>
  readonly connectionId: string
}

export type Recall = { readonly facts: ReadonlyArray<Fact>; readonly records: ReadonlyArray<RecordHit> }

const agentIdOf = async (db: Db, ws: string, module: string): Promise<string | null> => {
  const { data } = await db.from("agents").select("id").eq("workspace_id", ws).eq("module", module).limit(1).maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

/** Data hub rows the agent may read that match the question's words (title match), newest first. */
export const recallRecords = async (db: Db, ws: string, module: string, query: string, limit = 6): Promise<Array<RecordHit>> => {
  const words = [...new Set(query.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2))].slice(0, 5)
  if (!words.length) return []
  const agentId = await agentIdOf(db, ws, module)
  if (!agentId) return []
  const { data: grants } = await db.from("agent_connections").select("connection_id").eq("workspace_id", ws).eq("agent_id", agentId).in("purpose", ["data_source", "tool"])
  const ids = ((grants ?? []) as Array<{ connection_id: string }>).map((g) => g.connection_id)
  if (!ids.length) return []
  const or = words.map((w) => `title.ilike.%${w.replace(/[%_,()]/g, "")}%`).join(",")
  const { data, error } = await db.from("data_records").select("id, entity, title, occurred_at, data, connection_id")
    .eq("workspace_id", ws).in("connection_id", ids).or(or).order("occurred_at", { ascending: false, nullsFirst: false }).limit(limit)
  if (error) {
    console.error("brain recallRecords failed:", error.message)
    return []
  }
  return ((data ?? []) as Array<{ id: string; entity: string; title: string; occurred_at: string | null; data: Record<string, unknown>; connection_id: string }>)
    .map((r) => ({ id: r.id, entity: r.entity, title: r.title, occurredAt: r.occurred_at, data: r.data ?? {}, connectionId: r.connection_id }))
}

export const recall = async (db: Db, ws: string, a: { module: string; audience: Audience; query: string; factLimit?: number; recordLimit?: number }): Promise<Recall> => {
  const [view, records] = await Promise.all([
    factsForView(db, ws, a.audience, a.module),
    a.audience === "internal" ? recallRecords(db, ws, a.module, a.query, a.recordLimit ?? 6) : Promise.resolve([]),
  ])
  return { facts: searchFacts(view, a.query, a.factLimit ?? 8), records }
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "")

/** The per-turn block an agent receives (empty string when nothing matched). */
export const recallBlock = (r: Recall): string => {
  const parts: Array<string> = []
  if (r.facts.length) {
    parts.push(`BRAIN FACTS (approved and in force; they outrank business documents when they disagree; cite as [F1], [F2]...):\n${r.facts
      .map((f, i) => `[F${i + 1}] ${factLine(f)}${f.validFrom ? ` (từ ${day(f.validFrom)})` : ""}`).join("\n")}`)
  }
  if (r.records.length) {
    parts.push(`DATA RECORDS (from the business's own systems, as stored; use their numbers as they are, never add them up from text; cite as [D1]...):\n${r.records
      .map((d, i) => `[D${i + 1}] ${d.entity} · ${d.title}${d.occurredAt ? ` · ${day(d.occurredAt)}` : ""} · ${clip(JSON.stringify(d.data), 500)}`).join("\n")}`)
  }
  return parts.join("\n\n")
}

/** The standing part of an agent's memory, for its synced workspace (AGENTS.md): every fact in its view and its approved lessons. */
export const standingMemory = async (db: Db, ws: string, module: string, audience: Audience, budget = 6000): Promise<string> => {
  const [facts, lessons] = await Promise.all([factsForView(db, ws, audience, module), lessonsForModule(db, ws, module)])
  const sections: Array<string> = []
  if (facts.length) {
    const lines: Array<string> = []
    let left = budget
    // Grouped by subject so "Combo thư giãn" reads as one block.
    const bySubject = new Map<string, Array<Fact>>()
    for (const f of facts) bySubject.set(f.subjectKey, [...(bySubject.get(f.subjectKey) ?? []), f])
    for (const group of bySubject.values()) {
      const block = `### ${group[0].subjectLabel}\n${group.map((f) => `- ${f.attributeLabel}: ${f.value}`).join("\n")}`
      if (block.length > left) break
      left -= block.length
      lines.push(block)
    }
    sections.push(`## Sự thật đang hiệu lực (bộ não chung, chủ doanh nghiệp đã duyệt; cao hơn tài liệu khi mâu thuẫn)\n${lines.join("\n\n")}`)
  }
  if (lessons.length) sections.push(`## Bài học đã duyệt (cách làm việc chủ muốn)\n${lessons.map((l: Lesson) => `- ${l.title}: ${l.body}${l.appliesWhen ? ` (khi: ${l.appliesWhen})` : ""}`).join("\n")}`)
  return sections.join("\n\n")
}
