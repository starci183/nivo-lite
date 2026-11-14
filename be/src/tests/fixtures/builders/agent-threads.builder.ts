import type { FakeIds } from "@starci/jest-preset"
import { factSlugOf } from "@modules/domain/brain-facts"
import {
    maskedOf,
    type LessonCandidate,
    type LessonCandidatesService,
    type LessonFactKey,
    type LessonPlace,
} from "@modules/domain/brain-lessons"

/** A lesson candidate row the in-memory store changes in place. */
export type MemoryLessonRow = { -readonly [Key in keyof LessonCandidate]: LessonCandidate[Key] }

/** The in-memory lesson store: its rows, and the methods of `LessonCandidatesService` that read and write them. */
export interface MemoryLessons {
    /** Every candidate kept, in the order kept. */
    readonly rows: Array<MemoryLessonRow>
    /** The store's methods, to hand to `mock<LessonCandidatesService>(...)`. */
    readonly methods: Partial<LessonCandidatesService>
}

/** The slug a fact key is matched on. */
const keySlugOf = (key: LessonFactKey): string => `${factSlugOf(key.subjectLabel)}|${factSlugOf(key.attributeLabel)}`

/** Runs `act` on every chosen row that passes `when`. */
const eachRowOf = (
    rows: ReadonlyArray<MemoryLessonRow>,
    chosen: ReadonlyArray<string>,
    when: (row: LessonCandidate) => boolean,
    act: (row: MemoryLessonRow) => unknown,
): void => {
    rows.filter((row) => chosen.includes(row.id) && when(row)).forEach((row) => act(row))
}

/** The rows answered at the place since the given time, the latest first. */
const recentRowsOf = (rows: ReadonlyArray<MemoryLessonRow>, place: LessonPlace, since: Date): ReadonlyArray<LessonCandidate> =>
    rows
        .filter(
            (row) =>
                row.agentId === place.agentId &&
                row.stepKey === place.stepKey &&
                row.workflowId === place.workflowId &&
                row.answeredAt >= since.toISOString(),
        )
        .toSorted((left, right) => right.answeredAt.localeCompare(left.answeredAt))

/** The lesson store methods that move rows between the candidate, proposed and closed states, over the rows in memory. */
const changeMethodsOf = (
    rows: Array<MemoryLessonRow>,
    each: (chosen: ReadonlyArray<string>, when: (row: LessonCandidate) => boolean, act: (row: MemoryLessonRow) => unknown) => void,
): Partial<LessonCandidatesService> => ({
    proposed: (_ws, chosen, changeId, key) => {
        each(
            chosen,
            (row) => row.status === "proposing" || row.status === "candidate",
            (row) => Object.assign(row, { status: "proposed", changeId, factKey: key }),
        )
        return Promise.resolve()
    },
    declined: (_ws, chosen) => {
        each(
            chosen,
            (row) => row.status === "candidate",
            (row) => (row.status = "declined"),
        )
        return Promise.resolve()
    },
    openOfKey: (_ws, key) => {
        const slug = keySlugOf(key)
        const open = rows.find((row) => row.status === "proposed" && row.factKey !== null && keySlugOf(row.factKey) === slug)
        return Promise.resolve(open?.changeId ?? null)
    },
    openChanges: () =>
        Promise.resolve([
            ...new Set(rows.flatMap((row) => (row.status === "proposed" && row.changeId !== null ? [row.changeId] : []))),
        ]),
    ofChange: (_ws, changeId) => Promise.resolve(rows.filter((row) => row.changeId === changeId)),
    closeChange: (_ws, changeId, to, factId) => {
        const closing = rows.filter((row) => row.changeId === changeId && row.status === "proposed")
        closing.forEach((row) => Object.assign(row, { status: to, factId: to === "learned" ? factId : null }))
        return Promise.resolve(closing.length)
    },
})

/** The lesson store in memory, with the real masking policy (no grouping: the draft call's model groups); ids come from `ids`. */
export const memoryLessonsOf = (ids: FakeIds): MemoryLessons => {
    const rows: Array<MemoryLessonRow> = []
    const each = (
        chosen: ReadonlyArray<string>,
        when: (row: LessonCandidate) => boolean,
        act: (row: MemoryLessonRow) => unknown,
    ): void => {
        eachRowOf(rows, chosen, when, act)
    }
    const recent = (_ws: string, place: LessonPlace, since: Date): Promise<ReadonlyArray<LessonCandidate>> =>
        Promise.resolve(recentRowsOf(rows, place, since))
    const methods: Partial<LessonCandidatesService> = {
        keptOf: (_ws, stopId) =>
            Promise.resolve(new Set(rows.filter((row) => row.stopId === stopId).map((row) => row.answeredAt))),
        recent,
        keep: (_ws, input) => {
            const existing = rows.find((row) => row.stopId === input.stopId && row.answeredAt === input.answeredAt)
            if (existing !== undefined) return Promise.resolve({ candidate: existing, isNew: false })
            const question = maskedOf(input.question, 600)
            const groupId = ids.next()
            const row: MemoryLessonRow = {
                ...input,
                id: ids.next(),
                question,
                answer: maskedOf(input.answer, 1000),
                general: null,
                groupId,
                status: "candidate",
                changeId: null,
                factKey: null,
                factId: null,
            }
            rows.push(row)
            return Promise.resolve({ candidate: row, isNew: true })
        },
        claim: (_ws, chosen) => {
            const free = rows.filter((row) => chosen.includes(row.id) && row.status === "candidate")
            if (free.length !== chosen.length) return Promise.resolve(false)
            free.forEach((row) => (row.status = "proposing"))
            return Promise.resolve(true)
        },
        release: (_ws, chosen) => {
            each(
                chosen,
                (row) => row.status === "proposing",
                (row) => (row.status = "candidate"),
            )
            return Promise.resolve()
        },
        ...changeMethodsOf(rows, each),
    }
    return { rows, methods }
}
