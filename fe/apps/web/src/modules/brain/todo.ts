import { FINDING_KINDS } from "./findings"
import type { FindingKind } from "./findings"
import type { FindingView } from "./finding-view"

/** What the queue of what needs doing is narrowed to: everything, one kind of finding, the facts waiting, or the customer questions. */
export type TodoFilter = "all" | FindingKind | "facts" | "ask"

/** One filter of the queue and how many items it holds. */
export interface TodoFilterOption {
    readonly id: TodoFilter
    readonly count: number
}

/** What the queue is counted from. */
interface TodoCounts {
    /** Findings still open or confirmed. */
    readonly findings: number
    /** Cards of facts waiting for a decision. */
    readonly factCards: number
    /** Customer questions nobody has answered. */
    readonly questions: number
}

/** The one number of what needs doing: findings, facts waiting and customer questions. The tab and the rail show this number. */
export const todoCountOf = (counts: TodoCounts): number => counts.findings + counts.factCards + counts.questions

/** The filters of the queue: all of it first, then every kind of finding that has items, the facts waiting and the questions. */
export const todoFiltersOf = (
    findings: ReadonlyArray<FindingView>,
    factCards: number,
    questions: number,
): ReadonlyArray<TodoFilterOption> => {
    const kinds = FINDING_KINDS.map((kind): TodoFilterOption => ({
        id: kind,
        count: findings.filter((one) => one.kind === kind).length,
    }))
    const all: TodoFilterOption = { id: "all", count: findings.length + factCards + questions }
    const facts: ReadonlyArray<TodoFilterOption> = factCards > 0 ? [{ id: "facts", count: factCards }] : []
    const asks: ReadonlyArray<TodoFilterOption> = questions > 0 ? [{ id: "ask", count: questions }] : []
    return [all, ...kinds.filter((one) => one.count > 0), ...facts, ...asks]
}

/** The findings a filter keeps; the facts and questions filters keep none, since those are not findings. */
export const findingsOfFilter = (
    findings: ReadonlyArray<FindingView>,
    filter: TodoFilter,
): ReadonlyArray<FindingView> => {
    if (filter === "all") return findings
    return findings.filter((one) => one.kind === filter)
}
