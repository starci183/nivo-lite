import type { Evidence, FactInput } from "./brain-facts.contracts"
import { factSlugOf, numberOf } from "./fact-key.policy"

/** How many pieces of evidence a fact keeps (the newest). */
export const EVIDENCE_MAX = 20

/** A fact input after trimming and bounding, with its keys. */
export interface NormalFact {
    /** The subject as written, bounded. */
    readonly subjectLabel: string
    /** The attribute as written, bounded. */
    readonly attributeLabel: string
    /** The value, bounded. */
    readonly value: string
    /** The normalised subject. */
    readonly subjectKey: string
    /** The normalised attribute. */
    readonly attribute: string
    /** The value as a number, when it is one. */
    readonly valueNumber: number | null
}

/** Trims and bounds an input; null when it lacks a subject, an attribute or a value. */
export const normalFact = (input: Pick<FactInput, "subjectLabel" | "attributeLabel" | "value">): NormalFact | null => {
    const subjectLabel = input.subjectLabel.trim().slice(0, 160)
    const attributeLabel = input.attributeLabel.trim().slice(0, 120)
    const value = input.value.trim().slice(0, 2000)
    const subjectKey = factSlugOf(subjectLabel)
    const attribute = factSlugOf(attributeLabel)
    if (subjectKey === "" || attribute === "" || value === "") return null
    return { subjectLabel, attributeLabel, value, subjectKey, attribute, valueNumber: numberOf(value) }
}

/** The evidence a fact has plus what is new, without repeats, keeping the newest. */
export const mergeEvidence = (have: ReadonlyArray<Evidence>, add: ReadonlyArray<Evidence>): Array<Evidence> => {
    const seen = new Set(have.map((item) => `${item.kind}:${item.ref}`))
    return [...have, ...add.filter((item) => !seen.has(`${item.kind}:${item.ref}`))].slice(-EVIDENCE_MAX)
}
