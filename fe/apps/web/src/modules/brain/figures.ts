import { isDocumentActive } from "@/modules/documents"
import type { BrainExtraction, BrainFact, BrainLesson, KnowledgeDocument } from "@/modules/types"
import { reviewBoardOf } from "./board"

/** The statuses of a document that mean a worker is still on it. */
const READING_STATUSES: ReadonlySet<string> = new Set(["queued", "running"])

/** The numbers the Second Brain page opens with. */
export interface BrainFigures {
    readonly documents: number
    readonly indexing: number
    readonly facts: number
    readonly scheduled: number
    readonly review: number
    readonly conflicts: number
    readonly lessons: number
    readonly proposedLessons: number
    readonly gaps: number
    /** Documents a worker is still on, by their status or by the reading of their facts. */
    readonly processing: number
    /** The proposals NIVO read out of the documents and that nobody has decided yet. */
    readonly extracted: number
    /** The facts and the lessons that wait for an owner or a manager to decide. */
    readonly waiting: number
}

/** What the figures are counted from. */
interface FiguresInput {
    readonly facts: ReadonlyArray<BrainFact>
    readonly lessons: ReadonlyArray<BrainLesson>
    readonly documents: ReadonlyArray<Pick<KnowledgeDocument, "status">>
    readonly extractions: ReadonlyArray<BrainExtraction>
    readonly gapsOpen: number
}

/** The figures of the page: the documents, the facts in force, what waits for review, the lessons and the unanswered questions. */
export const figuresOf = (input: FiguresInput): BrainFigures => {
    const plan = reviewBoardOf(input.facts)
    const indexing = input.documents.filter((one) => isDocumentActive(one.status)).length
    const reading = input.extractions.filter((one) => READING_STATUSES.has(one.status)).length
    return {
        documents: input.documents.length,
        indexing,
        facts: input.facts.filter((fact) => fact.status === "active").length,
        scheduled: input.facts.filter((fact) => fact.status === "scheduled").length,
        review: plan.cards,
        conflicts: plan.conflicts,
        lessons: input.lessons.filter((lesson) => lesson.status === "active").length,
        proposedLessons: input.lessons.filter((lesson) => lesson.status === "proposed").length,
        gaps: input.gapsOpen,
        processing: Math.max(indexing, reading),
        extracted: input.facts.filter((fact) => fact.status === "proposed" && fact.sourceKind === "document").length,
        waiting: plan.cards + input.lessons.filter((lesson) => lesson.status === "proposed").length,
    }
}
