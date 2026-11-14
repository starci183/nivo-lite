import type { Evidence, FactInput } from "./brain-facts.contracts"
import { factSlugOf, numberOf } from "./fact-key.policy"
import { dayStartMs } from "@modules/domain/workspace-settings/zoned-time.policy"

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

/** A value with the unit kept apart from it, in the one form the truth graph stores and reads. */
export interface UnitForm {
    /** The value, never saying the unit kept apart again. */
    readonly value: string
    /** The unit kept apart, or null when there is none or the value already says it. */
    readonly unit: string | null
}

/** What of a fact carries its value and unit. */
export interface ValueWithUnit {
    /** The value as written. */
    readonly value: string
    /** The unit kept apart, as written; null or blank when none. */
    readonly unit: string | null
}

/** A text for a regular expression, literally. */
const literal = (text: string): string => text.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`)

/** A unit as given: trimmed, or null when blank or absent (so a blank unit falls back to the one of the fact in force). */
export const unitOrNull = (unit: string | null | undefined): string | null => {
    const trimmed = unit?.trim() ?? ""
    return trimmed === "" ? null : trimmed
}

/**
 * The ONE normal form of a value and its unit (D-T5-1): the value never says the unit kept apart again. A value that ends with the
 * unit ("30.000 VND", "30.000VND" with unit "VND") is kept without that tail and the unit apart (a number with its unit); a value that
 * names the unit anywhere else ("32.000 VND per order" with unit "VND") already says it whole and keeps no unit apart. The unit counts
 * as named only as a word of its own (a unit "d" is not named by the "d" inside "don"). Every write of the store
 * (`BrainFactsService.propose`) and every read (`toFactRecord`) goes through it, so the policy tab, a chat change request and a
 * document write the same form, and a row stored before reads the same way.
 */
export const unitFormOf = (fact: ValueWithUnit): UnitForm => {
    const text = fact.value.trim()
    const apart = unitOrNull(fact.unit)
    if (apart === null) return { value: text, unit: null }
    const named = [...text.matchAll(new RegExp(String.raw`(?<!\p{L})${literal(apart)}(?![\p{L}\p{N}])`, "giu"))]
    if (named.length === 0) return { value: text, unit: apart }
    const [only] = named
    const head = only === undefined ? "" : text.slice(0, only.index).trimEnd()
    const tail = named.length === 1 && only !== undefined && only.index + only[0].length === text.length
    return tail && head !== "" ? { value: head, unit: apart } : { value: text, unit: null }
}

/** A value as people and prompts read it: the normal form, its unit after it. */
export const valueLineOf = (fact: ValueWithUnit): string => {
    const form = unitFormOf(fact)
    return form.unit === null ? form.value : `${form.value} ${form.unit}`
}

/** A bound of a validity window as a writer states it: an instant or a date, null for none, absent when not part of the write. */
export type StatedBound = string | null | undefined

/** A text that may be absent. */
export type MaybeText = string | null | undefined

/** A date with no time of the day: "2026-12-01". */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * The instant a stated bound means, in the shop's clock (D-BR-16): a date with no time is the START of that day in the workspace's time
 * zone (in Asia/Ho_Chi_Minh "2026-12-01" is 2026-11-30T17:00:00Z), never UTC midnight; an instant with a time or a zone is kept as it is;
 * an absent bound stays absent. The ONE helper every write of the store passes a window through (`BrainFactsService.propose`), so the
 * Second Brain page, a chat change request and the policy tab mean the same day.
 */
export const shopInstantOf = (stated: StatedBound, timeZone: string): StatedBound => {
    if (typeof stated !== "string") return stated
    const text = stated.trim()
    return DATE_ONLY.test(text) ? new Date(dayStartMs(text, timeZone)).toISOString() : stated
}

/** What makes two pieces of evidence the same: the kind, the address and, for a document, the passage it was read from. */
const evidenceKeyOf = (item: Evidence): string => `${item.kind}:${item.ref}:${item.chunkHash ?? ""}`

/** The evidence a fact has plus what is new, without repeats, keeping the newest. */
export const mergeEvidence = (have: ReadonlyArray<Evidence>, add: ReadonlyArray<Evidence>): Array<Evidence> => {
    const seen = new Set(have.map((item) => evidenceKeyOf(item)))
    return [...have, ...add.filter((item) => !seen.has(evidenceKeyOf(item)))].slice(-EVIDENCE_MAX)
}
