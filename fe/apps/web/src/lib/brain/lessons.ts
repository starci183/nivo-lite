import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { lessonFor, type Evidence, type Lesson, type LessonOrigin, type LessonStatus } from "./shared"

/**
 * Lessons: how an agent should work (procedural memory). Proposed from the owner's edits, notes or outcomes, approved by an owner or
 * manager, versioned (a new version supersedes and retires the old one). Only ACTIVE lessons reach an agent.
 */

type Db = SupabaseClient

type Row = {
  id: string; module: string | null; title: string; body: string; applies_when: string; status: LessonStatus; origin: LessonOrigin
  evidence: Array<Evidence> | null; version: number; proposed_by: string; proposed_at: string; decided_by: string | null; decided_at: string | null
  supersedes_id: string | null
}

export const toLesson = (r: Row): Lesson => ({
  id: r.id, module: r.module, title: r.title, body: r.body, appliesWhen: r.applies_when, status: r.status, origin: r.origin,
  evidence: r.evidence ?? [], version: r.version, proposedBy: r.proposed_by, proposedAt: r.proposed_at, decidedBy: r.decided_by, decidedAt: r.decided_at,
})

const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message) }
const now = () => new Date().toISOString()

export type LessonInput = {
  readonly module: string | null
  readonly title: string
  readonly body: string
  readonly appliesWhen?: string
  readonly origin: LessonOrigin
  readonly evidence?: ReadonlyArray<Evidence>
  readonly proposedBy: string
  /** An owner or manager writing a lesson by hand applies it at once. */
  readonly apply?: boolean
  /** The lesson this one replaces (a new version). */
  readonly supersedesId?: string | null
}

export const proposeLesson = async (db: Db, ws: string, input: LessonInput): Promise<Lesson> => {
  const title = input.title.trim().slice(0, 160)
  const body = input.body.trim().slice(0, 2000)
  if (!title || !body) throw new Error("A lesson needs a title and what to do.")
  let version = 1
  if (input.supersedesId) {
    const { data } = await db.from("brain_lessons").select("version").eq("workspace_id", ws).eq("id", input.supersedesId).maybeSingle()
    version = ((data as { version: number } | null)?.version ?? 0) + 1
  }
  const { data, error } = await db.from("brain_lessons").insert({
    workspace_id: ws, module: input.module, title, body, applies_when: input.appliesWhen?.trim() ?? "", status: "proposed", origin: input.origin,
    evidence: input.evidence ?? [], version, supersedes_id: input.supersedesId ?? null, proposed_by: input.proposedBy,
  }).select("*").single()
  fail(error)
  const lesson = toLesson(data as Row)
  return input.apply ? decideLesson(db, ws, lesson.id, "active", input.proposedBy) : lesson
}

/** Approve (active) or turn down (rejected) a proposal. Approving a new version retires the one it supersedes. */
export const decideLesson = async (db: Db, ws: string, id: string, to: "active" | "rejected", decidedBy: string): Promise<Lesson> => {
  const { data, error } = await db.from("brain_lessons").update({ status: to, decided_by: decidedBy, decided_at: now() })
    .eq("workspace_id", ws).eq("id", id).eq("status", "proposed").select("*").maybeSingle()
  fail(error)
  if (!data) throw new Error("Only a proposed lesson can be decided.")
  const lesson = data as Row
  if (to === "active" && lesson.supersedes_id) {
    fail((await db.from("brain_lessons").update({ status: "retired" }).eq("workspace_id", ws).eq("id", lesson.supersedes_id).eq("status", "active")).error)
  }
  return toLesson(lesson)
}

export const retireLesson = async (db: Db, ws: string, id: string, decidedBy: string): Promise<Lesson> => {
  const { data, error } = await db.from("brain_lessons").update({ status: "retired", decided_by: decidedBy, decided_at: now() })
    .eq("workspace_id", ws).eq("id", id).eq("status", "active").select("*").maybeSingle()
  fail(error)
  if (!data) throw new Error("Only an active lesson can be retired.")
  return toLesson(data as Row)
}

export const listLessons = async (db: Db, ws: string, status?: LessonStatus | ReadonlyArray<LessonStatus>): Promise<Array<Lesson>> => {
  let q = db.from("brain_lessons").select("*").eq("workspace_id", ws)
  if (status) q = Array.isArray(status) ? q.in("status", status as Array<string>) : q.eq("status", status as string)
  const { data, error } = await q.order("proposed_at", { ascending: false }).limit(500)
  fail(error)
  return ((data ?? []) as Array<Row>).map(toLesson)
}

/** Active lessons for one agent (its own and the shared ones). */
export const lessonsForModule = async (db: Db, ws: string, module: string): Promise<Array<Lesson>> =>
  (await listLessons(db, ws, "active")).filter((l) => lessonFor(l, module))
