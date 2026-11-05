import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import { valueAt } from "../slots/paths"
import { cellTextOf } from "./cell-format"
import type { CellContext, CellFormat } from "./cell-format"

/** One fact of a record: the words of its term, the path of its value and how the value is drawn. */
export interface DetailFact {
    /** The words of the term. */
    readonly term: SpecText
    /** The path of the value in the record. */
    readonly path: string
    /** How the value is drawn; absent draws it as text. */
    readonly format?: CellFormat | undefined
}

/** A titled group of facts. */
export interface DetailSectionSpec {
    /** The words of the heading; absent draws the facts without one. */
    readonly title?: SpecText | undefined
    /** The facts of the group. */
    readonly items: ReadonlyArray<DetailFact>
}

/** What the detail block lists: a first group without a heading, then the titled groups. */
export interface DetailFacts {
    /** The facts of the first group, which has no heading. */
    readonly items: ReadonlyArray<DetailFact>
    /** The titled groups under it. */
    readonly sections?: ReadonlyArray<DetailSectionSpec> | undefined
}

/** One fact as the block draws it. */
export interface DetailItem {
    /** The key the fact is drawn under, unique in its group. */
    readonly id: string
    /** The words of the term, not yet translated. */
    readonly term: SpecText
    /** The text of the value; empty when the record holds none. */
    readonly text: string
}

/** One group as the block draws it. */
export interface DetailSection {
    /** The key the group is drawn under. */
    readonly id: string
    /** The words of the heading, not yet translated; null draws none. */
    readonly title: SpecText | null
    /** The facts of the group. */
    readonly items: ReadonlyArray<DetailItem>
}

/** The facts of one group read from the record. */
const itemsOf = (record: unknown, facts: ReadonlyArray<DetailFact>, context: CellContext): ReadonlyArray<DetailItem> =>
    facts.map((fact, index) => ({
        id: `${index}:${fact.path}`,
        term: fact.term,
        text: cellTextOf(valueAt(record, fact.path), fact.format, fact.path, context),
    }))

/** The groups of a record: the first without a heading when it has facts, then each titled group. */
export const detailSectionsOf = (
    record: unknown,
    facts: DetailFacts,
    context: CellContext,
): ReadonlyArray<DetailSection> => {
    const first: ReadonlyArray<DetailSection> =
        facts.items.length === 0 ? [] : [{ id: "facts", title: null, items: itemsOf(record, facts.items, context) }]
    const titled = (facts.sections ?? []).map((section, index): DetailSection => ({
        id: `section-${index}`,
        title: section.title ?? null,
        items: itemsOf(record, section.items, context),
    }))
    return [...first, ...titled]
}
