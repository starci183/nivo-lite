/**
 * Knowledge gaps, client-safe part: the shape of a gap and the keyword rules that dedupe similar questions and decide whether a new fact or
 * document answers one. No model and no embedding call anywhere: a question is reduced to its significant words (accents and stop words
 * removed) and compared as word sets.
 */
import { keyOf } from "./shared"

export type GapStatus = "open" | "answered" | "dismissed"

/** A question customers asked that the brain could not answer (one row stands for every similar question). */
export type KnowledgeGap = {
  readonly id: string
  readonly module: string
  readonly question: string
  readonly topic: string | null
  readonly attributeGuess: string | null
  readonly count: number
  readonly firstSeenAt: string
  readonly lastSeenAt: string
  readonly exampleConversationId: string | null
  readonly status: GapStatus
  readonly reopenedCount: number
}

/** Words that carry no topic ("bao nhiêu", "ạ", "the", "how"), in the accent-free form keyOf gives. */
const STOP = new Set([
  "la", "co", "khong", "ko", "k", "the", "nao", "bao", "nhieu", "gi", "a", "ah", "nha", "nhe", "oi", "ban", "minh", "em", "anh", "chi", "shop", "cho", "hoi", "xin",
  "vay", "duoc", "voi", "va", "cua", "o", "tai", "nay", "kia", "do", "nhu", "de", "can", "muon", "biet", "ma", "thi", "ra", "sao", "nhi", "vui", "long", "ad", "admin",
  "cac", "nhung", "mot", "may", "bi", "rat", "se", "dang", "da", "con", "hay", "hoac", "xem", "giup", "tu", "van", "cam", "on", "chao", "ben", "phai", "kieu",
  "the", "an", "is", "are", "do", "does", "how", "what", "much", "many", "can", "could", "i", "you", "your", "my", "me", "to", "of", "for", "in", "on", "at", "and", "or",
  "it", "there", "any", "have", "has", "be", "was", "will", "would", "please", "hi", "hello", "when", "where", "which", "who", "with", "about", "this", "that",
])

/** Significant words of a text, unique, in order of appearance. */
export const keywordsOf = (text: string): Array<string> => [...new Set(keyOf(text).split("-").filter((w) => w.length > 1 && !STOP.has(w)))]

/** Two questions ask the same thing when their word sets overlap this much (Jaccard) and share at least two words (one word: equal). */
const SAME_QUESTION = 0.65
export const sameQuestion = (a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean => {
  if (!a.length || !b.length) return false
  const bs = new Set(b)
  const inter = a.filter((w) => bs.has(w)).length
  const union = new Set([...a, ...b]).size
  return inter / union >= SAME_QUESTION && (inter >= 2 || union === 1)
}

/** Share of the question's words found in a text's words, and how many. */
export const coverage = (question: ReadonlyArray<string>, text: ReadonlySet<string>): { readonly share: number; readonly hits: number } => {
  const hits = question.filter((w) => text.has(w)).length
  return { share: question.length ? hits / question.length : 0, hits }
}

/** A fact answers a gap when it covers 60% of the question's words (at least two, or the one word there is). */
export const FACT_ANSWERS = 0.6
/** A whole document is longer, so words appear by chance: it must cover 75%. */
export const DOC_ANSWERS = 0.75
export const answers = (question: ReadonlyArray<string>, text: ReadonlySet<string>, min: number): boolean => {
  const c = coverage(question, text)
  return question.length > 0 && c.share >= min && c.hits >= Math.min(2, question.length)
}

/** "Combo thư giãn | Giá" -> subject "Combo thư giãn", attribute "Giá" (the reply contract's topic). */
export const splitTopic = (raw: string | null | undefined): { readonly subject: string | null; readonly attribute: string | null } => {
  const [subject, attribute] = (raw ?? "").split("|").map((s) => s.trim().slice(0, 120))
  return { subject: subject || null, attribute: attribute || null }
}
