import type { JsonValue } from "../schema/schema.types"

/**
 * The write trees of the entity engine (plan sections 2.4 and 9.2): data only, never SQL text. The workspace field is never in `values`
 * (the engine sets it from the scope); the system fields and the sequence fields are never written by a caller (the engine fills a sequence
 * on insert). Plan section 11: declared fields live in `records.data`, the version is a bigint that travels as decimal text.
 */

/** One written value: a scalar, or the object of a `jsonb` field (parsed through the field's declared shape). */
export type MutationValue = JsonValue

/** Field name to the value written. */
export type MutationValues = Readonly<Record<string, MutationValue>>

/** Relation name to the id of the target record, for the toOne relations an insert links (a required toOne must be present). */
export type MutationLinks = Readonly<Record<string, string>>

/** Inserts one record of an entity; `links` fills its toOne relations as `record_links` rows. */
export interface Insert<E extends string = string> {
    /** Discriminant. */
    readonly op: "insert"
    /** The entity name. */
    readonly entity: E
    /** The declared fields written, by field name. */
    readonly values: MutationValues
    /** The toOne relations linked, by relation name to target record id. */
    readonly links?: MutationLinks | undefined
}

/** Updates the record `key` when its version is still `expected`; a stale version answers `stale`, a hidden or absent record `missing`. */
export interface Update<E extends string = string> {
    /** Discriminant. */
    readonly op: "update"
    /** The entity name. */
    readonly entity: E
    /** The record id. */
    readonly key: string
    /** The version the caller read: the bigint `version` as decimal text. */
    readonly expected: string
    /** The declared fields changed, by field name. */
    readonly values: MutationValues
}

/** Inserts, or updates the record already holding the same values of a declared unique constraint. */
export interface Upsert<E extends string = string> {
    /** Discriminant. */
    readonly op: "upsert"
    /** The entity name. */
    readonly entity: E
    /** The name of a declared `unique` constraint of the entity. */
    readonly on: string
    /** The declared fields written, by field name. */
    readonly values: MutationValues
}

/** Deletes the record `key` of a deletable entity, when `expected` is given only while the version still matches. */
export interface Delete<E extends string = string> {
    /** Discriminant. */
    readonly op: "delete"
    /** The entity name. */
    readonly entity: E
    /** The record id. */
    readonly key: string
    /** The version the caller read, as decimal text; absent deletes whatever the version is. */
    readonly expected?: string | undefined
}

/** Finds the record a declared match key names, or inserts it (plan section 9.2). */
export interface Ensure<E extends string = string> {
    /** Discriminant. */
    readonly op: "ensure"
    /** The entity name. */
    readonly entity: E
    /** The name of a declared match key of the entity. */
    readonly match: string
    /** The declared fields: the match fields find, all of them create. */
    readonly values: MutationValues
}

/** Links the record `key` to the record `to` over a declared relation (a toOne relation replaces its link). */
export interface Link<E extends string = string> {
    /** Discriminant. */
    readonly op: "link"
    /** The entity name. */
    readonly entity: E
    /** The record id the link starts at. */
    readonly key: string
    /** The declared relation name. */
    readonly relation: string
    /** The record id the link points to. */
    readonly to: string
}

/** Removes the link of the record `key` to the record `to`; a required toOne relation is never unlinked. */
export interface Unlink<E extends string = string> {
    /** Discriminant. */
    readonly op: "unlink"
    /** The entity name. */
    readonly entity: E
    /** The record id the link starts at. */
    readonly key: string
    /** The declared relation name. */
    readonly relation: string
    /** The record id the link points to. */
    readonly to: string
}

/** Any write tree the engine runs. */
export type Mutation<E extends string = string> =
    Insert<E> | Update<E> | Upsert<E> | Delete<E> | Ensure<E> | Link<E> | Unlink<E>

/** Who writes: an action (a user's request) or a job. Projection entities are written by jobs only. */
export type MutationBy = "action" | "job"

/** What the engine answers for one mutation. */
export type MutationResult<R> =
    | { readonly ok: true; readonly row: R; readonly version: string; readonly created?: boolean }
    | { readonly ok: false; readonly reason: "taken"; readonly constraint: string; readonly refusal: string }
    | { readonly ok: false; readonly reason: "stale" }
    | { readonly ok: false; readonly reason: "missing" }
    | { readonly ok: false; readonly reason: "invalid"; readonly constraint?: string }

/** The codes `mutationProblems` reports. */
export type MutationProblemCode =
    | "MUTATION_ENTITY_UNKNOWN"
    | "MUTATION_OWNER_FIELD"
    | "MUTATION_FIELD_UNKNOWN"
    | "MUTATION_SYSTEM_FIELD"
    | "MUTATION_PROJECTION_WRITE"
    | "MUTATION_RELATION_UNKNOWN"
    | "MUTATION_RELATION_NOT_TO_ONE"
    | "MUTATION_LINK_MISSING"
    | "MUTATION_LINK_INVALID"
    | "MUTATION_LINK_REQUIRED"
    | "MUTATION_FIELD_SEQUENCE"
    | "MUTATION_FIELD_MISSING"
    | "MUTATION_VALUE_INVALID"
    | "MUTATION_VALUES_EMPTY"
    | "MUTATION_KEY_INVALID"
    | "MUTATION_UNIQUE_UNKNOWN"
    | "MUTATION_MATCH_KEY_UNKNOWN"
    | "MUTATION_KEY_VALUE_MISSING"
    | "MUTATION_NOT_DELETABLE"

/** One problem of a mutation tree. */
export interface MutationProblem {
    /** The code. */
    readonly code: MutationProblemCode
    /** The entity, or `<entity>.<field>`, the problem is at. */
    readonly at: string
}
