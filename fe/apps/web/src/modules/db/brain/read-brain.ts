import "server-only"

import { dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import {
    FACT_COLUMNS,
    GAP_COLUMNS,
    LESSON_COLUMNS,
    toExtraction,
    toFact,
    toGap,
    toLens,
    toLesson,
} from "./brain.mapper"
import type { FactRow, GapRow, LessonRow } from "./brain.mapper"
import type { BrainExtraction, BrainFact, BrainGap, BrainLens, BrainLesson } from "@/modules/types"

const FACTS_LIMIT = 2000
const LESSONS_LIMIT = 500
const GAPS_LIMIT = 50
const EXTRACTIONS_LIMIT = 500
const AGENTS_LIMIT = 100

/** Everything the Second Brain page shows, read under the row level security of the signed-in member. */
export interface BrainBundle {
    readonly facts: ReadonlyArray<BrainFact>
    readonly lessons: ReadonlyArray<BrainLesson>
    readonly gaps: ReadonlyArray<BrainGap>
    /** How many gaps are open in all (the list shows the most asked). */
    readonly gapsOpen: number
    readonly extractions: ReadonlyArray<BrainExtraction>
    readonly lenses: ReadonlyArray<BrainLens>
}

/**
 * Reads the facts in force, waiting or scheduled, the lessons, the agents as lenses and, for managers, the customer questions
 * nobody answered and where the reading of each document stands. Policies hide restricted facts from staff and the manager-only
 * tables from everyone else, so a staff member simply gets none of them.
 */
export const readBrain = async (workspaceId: string): Promise<DbOutcome<BrainBundle>> => {
    const client = await createServerDbClient()
    const [facts, lessons, gaps, open, extractions, agents] = await Promise.all([
        client
            .from("brain_facts")
            .select(FACT_COLUMNS)
            .eq("workspace_id", workspaceId)
            .in("status", ["active", "proposed", "scheduled"])
            .order("updated_at", { ascending: false })
            .limit(FACTS_LIMIT)
            .overrideTypes<Array<FactRow>>(),
        client
            .from("brain_lessons")
            .select(LESSON_COLUMNS)
            .eq("workspace_id", workspaceId)
            .in("status", ["active", "proposed", "retired"])
            .order("proposed_at", { ascending: false })
            .limit(LESSONS_LIMIT)
            .overrideTypes<Array<LessonRow>>(),
        client
            .from("knowledge_gaps")
            .select(GAP_COLUMNS)
            .eq("workspace_id", workspaceId)
            .eq("status", "open")
            .order("count", { ascending: false })
            .order("last_seen_at", { ascending: false })
            .limit(GAPS_LIMIT)
            .overrideTypes<Array<GapRow>>(),
        client
            .from("knowledge_gaps")
            .select("id", { count: "exact", head: true })
            .eq("workspace_id", workspaceId)
            .eq("status", "open"),
        client
            .from("brain_extractions")
            .select("source_id, status")
            .eq("workspace_id", workspaceId)
            .limit(EXTRACTIONS_LIMIT),
        client
            .from("agents")
            .select("module, name")
            .eq("workspace_id", workspaceId)
            .eq("status", "active")
            .order("created_at")
            .limit(AGENTS_LIMIT),
    ])
    const factRows = toOutcome(facts)
    if (factRows.kind !== "ok") return factRows
    const lessonRows = toOutcome(lessons)
    if (lessonRows.kind !== "ok") return lessonRows
    const gapRows = toOutcome(gaps)
    if (gapRows.kind !== "ok") return gapRows
    const extractionRows = toOutcome(extractions)
    if (extractionRows.kind !== "ok") return extractionRows
    const agentRows = toOutcome(agents)
    if (agentRows.kind !== "ok") return agentRows
    const seen = new Set<string>()
    return dbOk({
        facts: factRows.value.map(toFact),
        lessons: lessonRows.value.map(toLesson),
        gaps: gapRows.value.map(toGap),
        gapsOpen: open.count ?? 0,
        extractions: extractionRows.value.map(toExtraction),
        lenses: agentRows.value
            .filter((agent) => !seen.has(agent.module) && Boolean(seen.add(agent.module)))
            .flatMap(toLens),
    })
}
