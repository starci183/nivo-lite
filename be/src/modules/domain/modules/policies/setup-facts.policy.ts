import { factSlugOf, sameValue } from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import { ellipsize, withinBudget } from "@modules/platform/primitives"
import type { ProposedWrite } from "./setup-writes.policy"

/** The most lines the setup chat shows of what is on record. */
export const KNOWN_LINES_MAX = 30
/** The longest one line is. */
export const KNOWN_LINE_CHARS = 160
/** The most characters all lines take together, about 800 tokens. */
export const KNOWN_CHARS_MAX = 2400
/** The most conflict notes one reply takes. */
export const CONFLICT_NOTES_MAX = 2

/** Subjects of people: the setup chat never reads them back. */
const PRIVATE_SUBJECTS: ReadonlySet<string> = new Set(["customer", "person"])

/** A proposed value that differs from the fact in force on the same subject and attribute. */
export interface FactConflict {
    /** The subject as the owner said it. */
    readonly subject: string
    /** The attribute as the owner said it. */
    readonly attribute: string
    /** The value in force. */
    readonly current: string
    /** The value the owner gave. */
    readonly proposed: string
}

/**
 * The lines of what is on record for the setup chat: the facts that match the owner message first, then the rest by trust, never a
 * customer or a person, at most 30 lines of 160 characters inside 2400 characters.
 */
export const knownLinesOf = (inForce: ReadonlyArray<FactRecord>, hits: ReadonlyArray<FactRecord>): ReadonlyArray<string> => {
    const shown = (fact: FactRecord): boolean => !PRIVATE_SUBJECTS.has(fact.subjectType)
    const hitIds = new Set(hits.map((fact) => fact.id))
    const rest = inForce.filter((fact) => !hitIds.has(fact.id)).sort((a, b) => b.trust - a.trust)
    const ordered = [...hits, ...rest].filter(shown).slice(0, KNOWN_LINES_MAX)
    const lines = ordered.map((fact) =>
        ellipsize(`- ${fact.subjectLabel} - ${fact.attributeLabel}: ${fact.value}`.replace(/\s+/gu, " "), KNOWN_LINE_CHARS),
    )
    return withinBudget(lines, KNOWN_CHARS_MAX)
}

/** The proposed fact writes whose value differs from the fact in force on the same subject and attribute. */
export const conflictsOf = (
    writes: ReadonlyArray<ProposedWrite>,
    inForce: ReadonlyArray<FactRecord>,
): ReadonlyArray<FactConflict> =>
    writes.flatMap((write): ReadonlyArray<FactConflict> => {
        if (write.kind !== "fact") return []
        const { subjectLabel, attributeLabel, value } = write.payload
        const subjectKey = factSlugOf(subjectLabel)
        const attribute = factSlugOf(attributeLabel)
        const current = inForce.find(
            (fact) => fact.subjectKey === subjectKey && fact.attribute === attribute && !sameValue(fact.value, value),
        )
        return current === undefined ? [] : [{ subject: subjectLabel, attribute: attributeLabel, current: current.value, proposed: value }]
    })

/** The conflicts the reply does not already name by their current value, at most two. */
export const unmentionedConflicts = (
    conflicts: ReadonlyArray<FactConflict>,
    reply: string,
): ReadonlyArray<FactConflict> => {
    const said = reply.toLowerCase()
    return conflicts.filter((conflict) => !said.includes(conflict.current.toLowerCase())).slice(0, CONFLICT_NOTES_MAX)
}
