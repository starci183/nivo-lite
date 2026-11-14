import type { MeaningHit, StoredPassage, WordHit, WordMatch } from "./passage-search.contracts"
import { placeOfRow } from "./passage-place.policy"
import { candidateGroupsOf, totalWeightOf, type WordTerms } from "./word-terms.policy"

/** The most passages one leg of a search answers: the pool the fusion ranks. */
export const LEG_MAX = 40

/** The most passages one ordered read of a document answers. */
export const STRETCH_MAX = 12

/** A passage farther than this cosine distance from the query is no hit of the meaning leg. */
export const MEANING_MAX_DISTANCE = 0.8

/**
 * The words of a query as the index reads them: folded by the same `public.knowledge_fold` the stored `fts` uses and parsed by the
 * database's own web-search parser, so a number (`35.000`), a code (`SP-0123`) or a phone number is cut into exactly the tokens the
 * index holds, and Vietnamese matches with or without diacritics. Every word must appear.
 */
const ALL_WORDS = "websearch_to_tsquery('simple', public.knowledge_fold(:words))"

/** The same words with one being enough: the `&` of the parsed query read as `|` (a quoted phrase stays a phrase). */
const ANY_WORD = `CAST(replace(CAST(${ALL_WORDS} AS text), ' & ', ' | ') AS tsquery)`

/** A word match answered by one parsed query (`ranked` builds its statement from terms, `rankedWordsOf`). */
export type FixedWordMatch = Exclude<WordMatch, "ranked">

/** The tsquery expression of a word match; bind `:words`. */
export const wordQueryOf = (match: FixedWordMatch): string => (match === "any" ? ANY_WORD : ALL_WORDS)

/** The condition of the word leg on a passage alias: served by the GIN index on `fts`. */
export const wordHit = (alias: string, match: FixedWordMatch): string => `${alias}.fts @@ ${wordQueryOf(match)}`

/** The rank of the word leg on a passage alias: cover density, so words that stand close together rank higher. */
export const wordRank = (alias: string, match: FixedWordMatch): string => `ts_rank_cd(${alias}.fts, ${wordQueryOf(match)})`

/** The tsquery of one term of a ranked search, bound as `:<param>`: folded and parsed like the index, kept as a phrase. */
const termQuery = (param: string): string => `phraseto_tsquery('simple', public.knowledge_fold(:${param}))`

/**
 * One step of the rank for a passage triage judged a RULE (the shop states it), against a log, a letter, a chat or a record that holds the
 * same words: below one step of coverage (a coverage point is worth 2), above every closeness and frequency term (together below 1).
 * Brain walk 3: a care tip of the shop's guide lost to five handbook paragraphs and a supplier price sheet that repeat the same words.
 */
const rulePreference = (alias: string): string => `CASE WHEN ${alias}.triage = 'rule' THEN 1 ELSE 0 END`

/** What holding one term is worth in the coverage of a passage alias: its weight when the passage holds it, else 0. */
const heldWeight = (alias: string, param: string, weight: number): string =>
    `CASE WHEN ${alias}.fts @@ ${termQuery(param)} THEN ${String(weight)} ELSE 0 END`

/** The statement parts of a ranked word search over a passage alias, with the parameters they bind. */
export interface RankedWords {
    /** The condition a candidate passage meets (served by the GIN index on `fts`). */
    readonly hit: string
    /** How much of the terms a passage holds: the sum of the weights of the terms it holds. */
    readonly coverage: string
    /** The rank: twice the coverage, then 1 for a rule passage, then (below 1) how close together and how often the terms stand. */
    readonly rank: string
    /** The terms, phrases and excluded words, bound by name. */
    readonly parameters: Readonly<Record<string, string>>
    /** The coverage of a passage that holds every term. */
    readonly total: number
}

/**
 * The ranked word leg: a passage is a candidate when it meets one group of `candidateGroupsOf` (a naming code; else two neighbouring
 * terms side by side with half of the rest), every quoted phrase and no excluded word; it ranks by the weight of the terms it holds
 * (a code-like term three times a word), then whether triage judged it a rule of the shop, then
 * by the cover density of all the terms together (words standing close rank higher) and by how often they appear. Every term is a
 * bound parameter the database folds and parses itself; only positions and weights computed here are written into the SQL. Null when
 * the query has nothing to search by.
 */
export const rankedWordsOf = (alias: string, words: WordTerms): RankedWords | null => {
    const terms = words.terms.map((term, at) => ({ ...term, param: `wt${String(at)}` }))
    const phrases = words.phrases.map((phrase, at) => ({ phrase, param: `wp${String(at)}` }))
    const excluded = words.excluded.map((word, at) => ({ word, param: `wx${String(at)}` }))
    const queryOf = (at: number): string => termQuery(terms[at]?.param ?? "")
    // A run of two terms is a phrase: the two side by side in this order (`tsquery_phrase`, the `<->` of the index's parser).
    const runOf = (run: ReadonlyArray<number>): string =>
        run.length === 1 ? queryOf(run[0] ?? 0) : `tsquery_phrase(${run.map((at) => queryOf(at)).join(", ")})`
    const groups = candidateGroupsOf(words.terms).map((group) => group.map((run) => runOf(run)).join(" && "))
    const any = [...groups.map((group) => `(${group})`), ...phrases.map((one) => termQuery(one.param))]
    if (any.length === 0) return null
    const each = terms.map((term) => termQuery(term.param))
    const all = each.length === 0 ? phrases.map((one) => termQuery(one.param)) : each
    const coverage = terms.length === 0 ? "0" : `(${terms.map((term) => heldWeight(alias, term.param, term.weight)).join(" + ")})`
    const conditions = [
        `${alias}.fts @@ (${any.join(" || ")})`,
        ...phrases.map((one) => `${alias}.fts @@ ${termQuery(one.param)}`),
        ...excluded.map((one) => `NOT (${alias}.fts @@ ${termQuery(one.param)})`),
    ]
    return {
        hit: conditions.join(" AND "),
        coverage,
        rank: `2 * ${coverage} + ${rulePreference(alias)} + 0.5 * ts_rank_cd(${alias}.fts, ${all.join(" && ")}, 32) + 0.4 * ts_rank(${alias}.fts, ${all.join(" || ")}, 32)`,
        parameters: Object.fromEntries([
            ...terms.map((term): [string, string] => [term.param, term.text]),
            ...phrases.map((one): [string, string] => [one.param, one.phrase]),
            ...excluded.map((one): [string, string] => [one.param, one.word]),
        ]),
        total: totalWeightOf(words.terms),
    }
}

/**
 * True when a passage of the ranked leg holds every term of a query worth fusing first: a code, or at least two words (one common
 * word held is no evidence the passage answers).
 */
export const isComplete = (coverage: number, total: number): boolean => total >= 2 && coverage >= total

/** The cosine distance of a passage alias to the query vector: the ORDER BY the HNSW index serves; bind `:vector`. */
export const meaningDistance = (alias: string): string =>
    `(${alias}.embedding OPERATOR(extensions.<=>) CAST(:vector AS extensions.vector))`

/** A passage row as the statements of this capability name its columns. */
export interface PassageRawRow {
    /** The passage id. */
    readonly id: string
    /** The document it was cut from. */
    readonly sourceId: string
    /** The module it is for, or null. */
    readonly module: string | null
    /** Its position in the document. */
    readonly ord: number
    /** The text. */
    readonly content: string
    /** public or internal. */
    readonly visibility: string
    /** The trust gate column, as the driver hands it. */
    readonly customerReady: unknown
    /** The kind of place it sits at, or null. */
    readonly placeKind: string | null
    /** The label of that place, or null. */
    readonly placeLabel: string | null
    /** The text rank, on a row of the word leg. */
    readonly rank?: unknown
    /** The cosine distance, on a row of the meaning leg. */
    readonly distance?: unknown
    /** The weight of the query terms the passage holds, on a row of the ranked word leg. */
    readonly coverage?: unknown
}

/** A number a raw row carries (the driver hands a `real` or a `double precision` as a number or as text), or 0. */
const numberOf = (value: unknown): number => {
    const read = typeof value === "string" ? Number(value) : value
    return typeof read === "number" && Number.isFinite(read) ? read : 0
}

/** A stored passage from its raw row. */
export const storedPassageOf = (row: PassageRawRow): StoredPassage => ({
    id: row.id,
    sourceId: row.sourceId,
    module: row.module,
    order: row.ord,
    content: row.content,
    visibility: row.visibility,
    customerReady: row.customerReady === true,
    place: placeOfRow(row.placeKind, row.placeLabel),
})

/**
 * The hits of the word leg in their one order: rank first, then the passage id, so two reads of the same data agree. `completeOf`
 * says whether a row holds every word of the query (`isComplete` on the ranked leg; always on the leg that requires every word).
 */
export const wordHitsOf = (
    rows: ReadonlyArray<PassageRawRow>,
    completeOf: (coverage: number) => boolean = () => false,
): ReadonlyArray<WordHit> =>
    rows
        .map((row) => ({ ...storedPassageOf(row), rank: numberOf(row.rank), complete: completeOf(numberOf(row.coverage)) }))
        .toSorted((left, right) => right.rank - left.rank || left.id.localeCompare(right.id))

/** The hits of the meaning leg in their one order (distance, then id), without the passages too far to be a hit. */
export const meaningHitsOf = (rows: ReadonlyArray<PassageRawRow>): ReadonlyArray<MeaningHit> =>
    rows
        .map((row) => ({ ...storedPassageOf(row), distance: numberOf(row.distance) }))
        .filter((hit) => hit.distance < MEANING_MAX_DISTANCE)
        .toSorted((left, right) => left.distance - right.distance || left.id.localeCompare(right.id))

/** A wanted count inside 1 and the most a read answers. */
export const boundedOf = (wanted: number, most: number): number => Math.max(1, Math.min(Math.trunc(wanted), most))
