import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { DOC_ANSWERS, FACT_ANSWERS, answers, keywordsOf, sameQuestion, splitTopic, type GapStatus, type KnowledgeGap } from "./gaps-shared"
import { keyOf, type Fact } from "./shared"

/**
 * Knowledge gaps (server side): the questions customers asked that the brain could not answer. The loop:
 *   a customer turn with no answer in the knowledge  ->  recordGap  (one row per similar question, with a count)
 *   the owner adds a fact or a document that answers it  ->  resolveGapsForFact / resolveGapsForDocument  (status answered)
 *   a customer asks it again  ->  recordGap reopens it.
 * Similar questions are merged by their significant words (gaps-shared.ts); nothing here calls a model or an embedding.
 * Every function takes the database client and the workspace id, like src/lib/brain/facts.ts.
 */

type Db = SupabaseClient

type Row = {
  id: string; module: string; question: string; question_key: string; keywords: Array<string> | null; topic: string | null; attribute_guess: string | null
  count: number; first_seen_at: string; last_seen_at: string; example_conversation_id: string | null; status: GapStatus; reopened_count: number
}

const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message) }
const now = () => new Date().toISOString()
const QUESTION_MAX = 300
/** How many gaps are compared with a new question, and how many a screen lists. */
const CANDIDATES = 300
const LIST_MAX = 50

const toGap = (r: Row): KnowledgeGap => ({
  id: r.id, module: r.module, question: r.question, topic: r.topic, attributeGuess: r.attribute_guess, count: r.count, firstSeenAt: r.first_seen_at,
  lastSeenAt: r.last_seen_at, exampleConversationId: r.example_conversation_id, status: r.status, reopenedCount: r.reopened_count,
})

/** The gaps with these statuses (default: open), the most asked first, then the most recent. */
export const listGaps = async (db: Db, ws: string, status: ReadonlyArray<GapStatus> = ["open"], limit = LIST_MAX): Promise<Array<KnowledgeGap>> => {
  const { data, error } = await db.from("knowledge_gaps").select("*").eq("workspace_id", ws).in("status", status as Array<string>)
    .order("count", { ascending: false }).order("last_seen_at", { ascending: false }).limit(Math.min(limit, 200))
  fail(error)
  return ((data ?? []) as Array<Row>).map(toGap)
}

export type GapInput = {
  readonly module: string
  /** The customer's question, as written. */
  readonly question: string
  /** "subject | attribute" the answer would be filed under (the reply's knowledge_gap.topic), when the model gave one. */
  readonly topic?: string | null
  readonly conversationId?: string | null
  /** Who noticed: the reply itself (model) or a search that found nothing (retrieval). */
  readonly source: "model" | "retrieval"
}

/**
 * A customer asked something the brain could not answer. A similar open, answered or dismissed gap of the same module counts it again
 * (answered -> open: the answer did not work or never reached the agent; dismissed stays dismissed); otherwise a new gap starts.
 * Returns null when the question has no significant word to remember it by.
 */
export const recordGap = async (db: Db, ws: string, input: GapInput): Promise<{ readonly gap: KnowledgeGap; readonly isNew: boolean; readonly reopened: boolean } | null> => {
  const question = input.question.replace(/\s+/g, " ").trim().slice(0, QUESTION_MAX)
  const keywords = keywordsOf(question)
  if (!keywords.length) return null
  const key = keyOf(question)
  const { subject, attribute } = splitTopic(input.topic)

  const find = async (): Promise<Row | null> => {
    const { data, error } = await db.from("knowledge_gaps").select("*").eq("workspace_id", ws).eq("module", input.module)
      .order("last_seen_at", { ascending: false }).limit(CANDIDATES)
    fail(error)
    const rows = (data ?? []) as Array<Row>
    return rows.find((r) => r.question_key === key) ?? rows.find((r) => sameQuestion(keywords, r.keywords ?? keywordsOf(r.question))) ?? null
  }
  const bump = async (row: Row) => {
    const reopened = row.status === "answered"
    const { data, error } = await db.from("knowledge_gaps").update({
      count: row.count + 1, last_seen_at: now(), updated_at: now(),
      topic: row.topic ?? subject, attribute_guess: row.attribute_guess ?? attribute,
      example_conversation_id: row.example_conversation_id ?? input.conversationId ?? null,
      ...(reopened ? { status: "open", answered_at: null, answered_by: null, reopened_count: row.reopened_count + 1 } : {}),
    }).eq("id", row.id).select("*").single()
    fail(error)
    return { gap: toGap(data as Row), isNew: false, reopened }
  }

  const existing = await find()
  if (existing) return bump(existing)
  const { data, error } = await db.from("knowledge_gaps").insert({
    workspace_id: ws, module: input.module, question, question_key: key, keywords, topic: subject, attribute_guess: attribute,
    example_conversation_id: input.conversationId ?? null, source: input.source,
  }).select("*").single()
  if (error) {
    // Two turns of the same question at once: the second insert hit the unique key, so it counts on the first one.
    if (error.code === "23505") {
      const again = await find()
      if (again) return bump(again)
    }
    throw new Error(error.message)
  }
  return { gap: toGap(data as Row), isNew: true, reopened: false }
}

/** The owner does not need this answered: it leaves the list (and stays dismissed even when asked again). */
export const dismissGap = async (db: Db, ws: string, id: string, by: string): Promise<void> => {
  fail((await db.from("knowledge_gaps").update({ status: "dismissed", dismissed_at: now(), dismissed_by: by, updated_at: now() }).eq("workspace_id", ws).eq("id", id).neq("status", "answered")).error)
}

/** The gap is answered by a fact or document (`by` = "fact:<id>" | "document:<id>" | "owner"). */
export const answerGap = async (db: Db, ws: string, id: string, by: string): Promise<void> => {
  fail((await db.from("knowledge_gaps").update({ status: "answered", answered_at: now(), answered_by: by, updated_at: now() }).eq("workspace_id", ws).eq("id", id).eq("status", "open")).error)
}

const openGaps = async (db: Db, ws: string): Promise<Array<Row>> => {
  const { data, error } = await db.from("knowledge_gaps").select("*").eq("workspace_id", ws).eq("status", "open").limit(CANDIDATES)
  fail(error)
  return (data ?? []) as Array<Row>
}

const wordsOf = (text: string): Set<string> => new Set(keyOf(text).split("-").filter((w) => w.length > 1))

/**
 * A fact became active: every open gap whose question words it covers is answered. Only a fact a customer-facing agent may read (public) can
 * answer a customer's question. Best effort: a failure here never blocks the fact.
 */
export const resolveGapsForFact = async (db: Db, ws: string, fact: Pick<Fact, "id" | "scope" | "subjectLabel" | "attributeLabel" | "value" | "status">): Promise<number> => {
  if (fact.status !== "active" || fact.scope !== "public") return 0
  try {
    const text = wordsOf(`${fact.subjectLabel} ${fact.attributeLabel} ${fact.value}`)
    let n = 0
    for (const g of await openGaps(db, ws)) {
      if (!answers(g.keywords ?? keywordsOf(g.question), text, FACT_ANSWERS)) continue
      await answerGap(db, ws, g.id, `fact:${fact.id}`)
      n += 1
    }
    return n
  } catch (e) {
    console.error("gaps: resolving for a fact failed:", e instanceof Error ? e.message : e)
    return 0
  }
}

/** A document is ready: open gaps of its module whose question words it covers are answered. Only public documents count. */
export const resolveGapsForDocument = async (db: Db, ws: string, doc: { readonly id: string; readonly title: string; readonly topic: string | null; readonly content: string; readonly module: string | null; readonly visibility: string }): Promise<number> => {
  if (doc.visibility !== "public") return 0
  try {
    const text = wordsOf(`${doc.title} ${doc.topic ?? ""} ${doc.content}`)
    let n = 0
    for (const g of await openGaps(db, ws)) {
      if (doc.module !== null && doc.module !== g.module) continue
      if (!answers(g.keywords ?? keywordsOf(g.question), text, DOC_ANSWERS)) continue
      await answerGap(db, ws, g.id, `document:${doc.id}`)
      n += 1
    }
    return n
  } catch (e) {
    console.error("gaps: resolving for a document failed:", e instanceof Error ? e.message : e)
    return 0
  }
}

/** How many gaps wait for an answer (the figure on the Second Brain). */
export const countOpenGaps = async (db: Db, ws: string): Promise<number> => {
  const { count, error } = await db.from("knowledge_gaps").select("id", { count: "exact", head: true }).eq("workspace_id", ws).eq("status", "open")
  fail(error)
  return count ?? 0
}
