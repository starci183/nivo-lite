import { rankFieldsOf, scoreOf, type GuideRankFields } from "./rank"
import type { GuideDoc, GuideGroup, GuideHit, GuideResults } from "./types"

/** The order the groups are drawn in. */
export const GUIDE_GROUPS: ReadonlyArray<GuideGroup> = ["go", "do", "found", "guide"]

/** The most rows one group shows. */
export const GROUP_LIMITS: Readonly<Record<GuideGroup, number>> = { go: 5, do: 4, found: 6, guide: 3 }

/** A document with its texts read once. */
export interface GuideIndexed {
    readonly doc: GuideDoc
    readonly fields: GuideRankFields
}

/** Reads the texts of every document once; call it when the documents change, not on every key. */
export const indexDocs = (docs: ReadonlyArray<GuideDoc>): ReadonlyArray<GuideIndexed> =>
    docs.map((doc) => ({ doc, fields: rankFieldsOf(doc.title, doc.keywords, doc.hint) }))

/** Ranks the documents for a query and groups the best of each group. A blank query finds nothing. */
export const searchDocs = (query: string, indexed: ReadonlyArray<GuideIndexed>): GuideResults => {
    const hits: Array<GuideHit> = []
    for (const entry of indexed) {
        const score = scoreOf(query, entry.fields)
        if (score > 0) hits.push({ doc: entry.doc, score })
    }
    hits.sort((a, b) => b.score - a.score)
    const results: Partial<Record<GuideGroup, ReadonlyArray<GuideHit>>> = {}
    for (const group of GUIDE_GROUPS) {
        const inGroup = hits.filter((hit) => hit.doc.group === group).slice(0, GROUP_LIMITS[group])
        if (inGroup.length > 0) results[group] = inGroup
    }
    return results
}

/** How many rows a result set draws. */
export const resultCount = (results: GuideResults): number =>
    GUIDE_GROUPS.reduce((total, group) => total + (results[group]?.length ?? 0), 0)

/** The first row drawn, the one Enter opens from the field. */
export const firstHit = (results: GuideResults): GuideHit | undefined => {
    for (const group of GUIDE_GROUPS) {
        const first = results[group]?.[0]
        if (first !== undefined) return first
    }
    return undefined
}
