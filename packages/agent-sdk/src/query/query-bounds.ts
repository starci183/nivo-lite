/**
 * The bounds every tree obeys (R69, R305): the page size, `in` values, search text, depth, width, group by, groups and include latest.
 * One place, so the zod parsers and `queryProblems` refuse the same trees.
 */
export const QUERY_BOUNDS = {
    pageSize: 100,
    inValues: 500,
    searchText: 200,
    depth: 6,
    width: 32,
    groupBy: 3,
    groups: 1000,
    includeLatest: 20,
} as const

/** The bounds of the shape of a tree beyond `QUERY_BOUNDS`. */
export const QUERY_LIMITS = {
    /** The longest field, relation, entity or measure name. */
    name: 120,
    /** The longest literal string a filter compares with. */
    scalarText: 4000,
    /** The longest opaque cursor. */
    cursor: 2000,
    /** The most fields one select holds. */
    select: 64,
    /** The most keys one order holds. */
    order: 8,
    /** The most toOne joins one query holds. */
    join: 8,
    /** The most toMany includes one query holds. */
    include: 8,
    /** The most fields one search holds. */
    searchFields: 8,
    /** The most measures one aggregate holds. */
    measures: 16,
} as const

/** A field name: a letter, then letters and digits; optionally `.<key>` naming a custom key of a jsonb field. */
export const FIELD_PATTERN: RegExp = /^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z0-9_-]{1,64})?$/

/** A relation or measure name: a letter, then letters and digits. */
export const IDENT_PATTERN: RegExp = /^[A-Za-z][A-Za-z0-9]*$/

/** An entity name: `<module>.<name>`, as a registry id. */
export const ENTITY_PATTERN: RegExp = /^[a-z][a-z0-9-]*\.[a-z][a-zA-Z0-9.-]*$/
