// PORTED from src/lib/brain/gaps.ts (keep in sync by hand): only the resolving half the knowledge jobs need
// (resolveGapsForDocument when a document is indexed, resolveGapsForFact when a fact becomes active). Same tables and rules.
import type { SupabaseClient } from "@supabase/supabase-js";
import { DOC_ANSWERS, FACT_ANSWERS, answers, keywordsOf } from "./gaps-shared";
import { keyOf, type Fact } from "./shared";

type Db = SupabaseClient;
type Row = { id: string; module: string; question: string; keywords: Array<string> | null };

const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message); };
const now = () => new Date().toISOString();
const CANDIDATES = 300;

const answerGap = async (db: Db, ws: string, id: string, by: string): Promise<void> => {
  fail((await db.from("knowledge_gaps").update({ status: "answered", answered_at: now(), answered_by: by, updated_at: now() }).eq("workspace_id", ws).eq("id", id).eq("status", "open")).error);
};

const openGaps = async (db: Db, ws: string): Promise<Array<Row>> => {
  const { data, error } = await db.from("knowledge_gaps").select("*").eq("workspace_id", ws).eq("status", "open").limit(CANDIDATES);
  fail(error);
  return (data ?? []) as Array<Row>;
};

const wordsOf = (text: string): Set<string> => new Set(keyOf(text).split("-").filter((w) => w.length > 1));

export const resolveGapsForFact = async (db: Db, ws: string, fact: Pick<Fact, "id" | "scope" | "subjectLabel" | "attributeLabel" | "value" | "status">): Promise<number> => {
  if (fact.status !== "active" || fact.scope !== "public") return 0;
  try {
    const text = wordsOf(`${fact.subjectLabel} ${fact.attributeLabel} ${fact.value}`);
    let n = 0;
    for (const g of await openGaps(db, ws)) {
      if (!answers(g.keywords ?? keywordsOf(g.question), text, FACT_ANSWERS)) continue;
      await answerGap(db, ws, g.id, `fact:${fact.id}`);
      n += 1;
    }
    return n;
  } catch (e) {
    console.error("gaps: resolving for a fact failed:", e instanceof Error ? e.message : e);
    return 0;
  }
};

/** A document is ready: open gaps of its module whose question words it covers are answered. Only public documents count. */
export const resolveGapsForDocument = async (db: Db, ws: string, doc: { readonly id: string; readonly title: string; readonly topic: string | null; readonly content: string; readonly module: string | null; readonly visibility: string }): Promise<number> => {
  if (doc.visibility !== "public") return 0;
  try {
    const text = wordsOf(`${doc.title} ${doc.topic ?? ""} ${doc.content}`);
    let n = 0;
    for (const g of await openGaps(db, ws)) {
      if (doc.module !== null && doc.module !== g.module) continue;
      if (!answers(g.keywords ?? keywordsOf(g.question), text, DOC_ANSWERS)) continue;
      await answerGap(db, ws, g.id, `document:${doc.id}`);
      n += 1;
    }
    return n;
  } catch (e) {
    console.error("gaps: resolving for a document failed:", e instanceof Error ? e.message : e);
    return 0;
  }
};
