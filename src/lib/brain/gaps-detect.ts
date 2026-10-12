import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { lensFacts, lensPassagesText, type Lens } from "../knowledge/lens"
import { recordGap } from "./gaps"
import { FACT_ANSWERS, coverage, keywordsOf } from "./gaps-shared"
import { keyOf } from "./shared"

/**
 * Did a customer turn hit a knowledge gap? Two signals, both free of credits:
 *   1. the reply itself says so: `knowledge_gap: { question, topic }` in the reply contract (the model knows it lacked the information);
 *   2. the reply asked for a person with no answer to propose (`needs_human` and `proposed_answer: null`) AND the customer's question is not
 *      covered by anything the lens can read: no fact and no passage (keyword search, no embedding) holds 60% of its significant words.
 * A reply that asked for a person for another reason (an order, a payment claim, an application) is not a gap.
 */

type Db = SupabaseClient

export type GapSignals = {
  readonly knowledgeGap: { readonly question: string; readonly topic: string } | null
  readonly needsHuman: boolean
  readonly proposedAnswer: string | null
  /** The turn was an order, a payment claim or an application: a person is needed for that, not for missing knowledge. */
  readonly isTransaction: boolean
}

/** True when nothing the lens may read covers the question's words. */
const isUncovered = async (lens: Lens, question: string, db: Db): Promise<boolean> => {
  const words = keywordsOf(question)
  if (!words.length) return false
  const [facts, passages] = await Promise.all([
    lensFacts(lens, question, 5, db).catch(() => []),
    lensPassagesText(lens, words.join(" "), 5, db).catch(() => []),
  ])
  const covered = (text: string) => {
    const c = coverage(words, new Set(keyOf(text).split("-")))
    return c.share >= FACT_ANSWERS && c.hits >= Math.min(2, words.length)
  }
  return !facts.some((f) => covered(`${f.subjectLabel} ${f.attributeLabel} ${f.value}`)) && !passages.some((p) => covered(`${p.title} ${p.topic ?? ""} ${p.content}`))
}

/** Record the gap of this turn when there is one. Never throws: learning must not break a customer's reply. */
export const noteKnowledgeGap = async (db: Db, lens: Lens, a: { readonly conversationId: string; readonly question: string; readonly signals: GapSignals }): Promise<void> => {
  try {
    const { signals } = a
    if (signals.knowledgeGap?.question.trim()) {
      await recordGap(db, lens.workspaceId, { module: lens.module, question: signals.knowledgeGap.question, topic: signals.knowledgeGap.topic, conversationId: a.conversationId, source: "model" })
      return
    }
    if (!signals.needsHuman || signals.proposedAnswer !== null || signals.isTransaction) return
    if (!(await isUncovered(lens, a.question, db))) return
    await recordGap(db, lens.workspaceId, { module: lens.module, question: a.question, conversationId: a.conversationId, source: "retrieval" })
  } catch (e) {
    console.error("gaps: noting a knowledge gap failed:", e instanceof Error ? e.message : e)
  }
}
