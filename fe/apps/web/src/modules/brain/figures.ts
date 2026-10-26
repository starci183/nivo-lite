import { isDocumentActive } from "@/modules/documents"
import type { BrainFact, BrainLesson, KnowledgeDocument } from "@/modules/types"
import { reviewBoardOf } from "./board"

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
    /** Documents a worker is still on: the same state the rows of the library show as "reading". */
    readonly processing: number
    /** The facts NIVO read out of the documents (waiting, in force or scheduled). */
    readonly learnedFacts: number
    /** The lessons the agents learned (in force or waiting). */
    readonly learnedLessons: number
    /** What was learned: the facts read from documents plus the lessons. */
    readonly learned: number
    /** The facts and the lessons that wait for an owner or a manager to decide. */
    readonly waiting: number
}

/** What the figures are counted from. */
interface FiguresInput {
    readonly facts: ReadonlyArray<BrainFact>
    readonly lessons: ReadonlyArray<BrainLesson>
    readonly documents: ReadonlyArray<Pick<KnowledgeDocument, "status">>
    readonly gapsOpen: number
}

/** The figures of the page: the documents, the facts in force, what waits for review, the lessons and the unanswered questions. */
export const figuresOf = (input: FiguresInput): BrainFigures => {
    const plan = reviewBoardOf(input.facts)
    const indexing = input.documents.filter((one) => isDocumentActive(one.status)).length
    const learnedFacts = input.facts.filter(
        (fact) => fact.sourceKind === "document" && ["proposed", "active", "scheduled"].includes(fact.status),
    ).length
    const learnedLessons = input.lessons.filter(
        (lesson) => lesson.status === "active" || lesson.status === "proposed",
    ).length
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
        processing: indexing,
        learnedFacts,
        learnedLessons,
        learned: learnedFacts + learnedLessons,
        waiting: plan.cards + input.lessons.filter((lesson) => lesson.status === "proposed").length,
    }
}
