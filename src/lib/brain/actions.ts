"use server"

import { revalidatePath } from "next/cache"
import { enqueueWorkspaceSync } from "../engine-queue"
import { isManagerRole } from "../members-shared"
import { generateWithOpenClaw } from "../openclaw-generate"
import { supabaseAdmin } from "../supabase/admin"
import { getSession } from "../session"
import type { Outcome } from "../types"
import { dismissGap, answerGap } from "./gaps"
import { applyFact, chooseFact, keepCurrent, proposeFact, rejectFact, retireFact, splitFact, type ProposeOutcome } from "./facts"
import { mineLessons, type MineResult } from "./learn"
import { decideLesson, proposeLesson, retireLesson } from "./lessons"
import type { Fact, Lesson, Scope, SubjectType } from "./shared"

/**
 * Brain actions for the /brain page. Owners and managers only; every change re-syncs the workspace's agents (their AGENTS.md carries the
 * facts and lessons in their view). What an owner or manager writes here is applied at once (they are the reviewer); everything the
 * agents or customers say arrives as a proposal through src/lib/brain/facts.ts.
 */

const manager = async () => {
  const session = await getSession()
  if (!isManagerRole(session.member.role)) throw new Error("Chỉ chủ sở hữu hoặc quản lý được sửa bộ não.")
  return { ws: session.workspace.id, name: session.member.displayName || session.userName, role: session.member.role }
}

const run = async <T,>(fn: () => Promise<T>): Promise<Outcome<T>> => {
  try {
    return { ok: true, data: await fn() }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

const changed = async (ws: string) => {
  await enqueueWorkspaceSync(ws)
  revalidatePath("/brain")
}

export type FactForm = {
  readonly subjectType: SubjectType
  readonly subjectLabel: string
  readonly attributeLabel: string
  readonly value: string
  readonly scope: Scope
  readonly modules: ReadonlyArray<string>
  readonly validFrom: string | null
  readonly validTo: string | null
  readonly note: string
  /** The knowledge gap this fact answers (the owner pressed "Thêm câu trả lời" on it): it is marked answered once the fact is in force. */
  readonly gapId?: string | null
}

/** Add a fact, or a new value for an existing one (the old value is superseded and kept in history). */
export const saveFact = async (form: FactForm): Promise<Outcome<{ fact: Fact; outcome: ProposeOutcome }>> => run(async () => {
  const me = await manager()
  const r = await proposeFact(supabaseAdmin(), me.ws, {
    subjectType: form.subjectType, subjectLabel: form.subjectLabel, attributeLabel: form.attributeLabel, value: form.value, scope: form.scope,
    modules: form.modules, validFrom: form.validFrom, validTo: form.validTo, sourceKind: me.role === "owner" ? "owner" : "manager",
    proposedBy: me.name, autoApply: true,
    evidence: [{ kind: "manual", ref: `manual:${Date.now()}`, label: `${me.name} nhập trên trang Bộ não`, quote: form.note.trim() || undefined, at: new Date().toISOString() }],
  })
  if (form.gapId && (r.outcome === "applied" || r.outcome === "reinforced") && r.fact.status === "active") await answerGap(supabaseAdmin(), me.ws, form.gapId, `fact:${r.fact.id}`)
  await changed(me.ws)
  return r
})

/** "Bỏ qua": the owner does not need this customer question answered. It leaves the list for good (soft: the row is kept). */
export const dismissGapAction = async (id: string): Promise<Outcome<null>> => run(async () => {
  const me = await manager()
  await dismissGap(supabaseAdmin(), me.ws, id, me.name)
  revalidatePath("/brain")
  return null
})

export const decideFact = async (id: string, to: "apply" | "reject", note = ""): Promise<Outcome<Fact>> => run(async () => {
  const me = await manager()
  const db = supabaseAdmin()
  const fact = to === "apply" ? await applyFact(db, me.ws, id, me.name, note) : await rejectFact(db, me.ws, id, me.name, note)
  await changed(me.ws)
  return fact
})

/** Several documents disagree: this value is applied and every other waiting value for the same subject + attribute is rejected with a note. */
export const chooseFactAction = async (id: string): Promise<Outcome<Fact>> => run(async () => {
  const me = await manager()
  const fact = await chooseFact(supabaseAdmin(), me.ws, id, me.name)
  await changed(me.ws)
  return fact
})

/** Several documents disagree: keep what is in force and reject every waiting value for that subject + attribute. */
export const keepCurrentAction = async (subjectKey: string, attribute: string): Promise<Outcome<number>> => run(async () => {
  const me = await manager()
  const n = await keepCurrent(supabaseAdmin(), me.ws, subjectKey, attribute, me.name)
  await changed(me.ws)
  return n
})

/** Keep both values: the proposal becomes its own fact for the situation it names; the current value stays. */
export const splitFactAction = async (id: string, situation: string): Promise<Outcome<Fact>> => run(async () => {
  const me = await manager()
  const fact = await splitFact(supabaseAdmin(), me.ws, id, situation, me.name)
  await changed(me.ws)
  return fact
})

export const retireFactAction = async (id: string, note = ""): Promise<Outcome<Fact>> => run(async () => {
  const me = await manager()
  const fact = await retireFact(supabaseAdmin(), me.ws, id, me.name, note)
  await changed(me.ws)
  return fact
})

export const saveLesson = async (input: { module: string | null; title: string; body: string; appliesWhen: string }): Promise<Outcome<Lesson>> => run(async () => {
  const me = await manager()
  const lesson = await proposeLesson(supabaseAdmin(), me.ws, { ...input, origin: "manual", proposedBy: me.name, apply: true })
  await changed(me.ws)
  return lesson
})

export const decideLessonAction = async (id: string, to: "active" | "rejected"): Promise<Outcome<Lesson>> => run(async () => {
  const me = await manager()
  const lesson = await decideLesson(supabaseAdmin(), me.ws, id, to, me.name)
  await changed(me.ws)
  return lesson
})

export const retireLessonAction = async (id: string): Promise<Outcome<Lesson>> => run(async () => {
  const me = await manager()
  const lesson = await retireLesson(supabaseAdmin(), me.ws, id, me.name)
  await changed(me.ws)
  return lesson
})

/**
 * Study one agent's recent corrections: keep them as regression cases and propose lessons for review. The model call is NIVO's
 * (usage kind `guide`: metered, never billed to the workspace allowance).
 */
export const mineLessonsAction = async (module: string): Promise<Outcome<MineResult>> => run(async () => {
  const me = await manager()
  const result = await mineLessons(supabaseAdmin(), me.ws, module, async (messages) => {
    const r = await generateWithOpenClaw({ workspaceId: me.ws, purpose: "brain_lessons", kind: "guide", module: "other", responseFormat: "json", timeoutMs: 60_000, messages })
    return r.ok ? { ok: true, output: r.output } : { ok: false }
  })
  revalidatePath("/brain")
  return result
})
