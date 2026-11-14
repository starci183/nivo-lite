/** The verb of one record tool, by what it does to the records. */
export type RecordVerb = "get" | "list" | "create" | "update"

/** One record as a record tool answers it: its system fields, and its declared fields under `values`. */
export interface RecordView {
    /** The record id. */
    readonly id: string
    /** The version token, as decimal text: what `nivo.tool.record.update` takes as `version`. */
    readonly version: string
    /** When it was created, ISO text. */
    readonly createdAt: string
    /** When it was last written, ISO text. */
    readonly updatedAt: string
    /** The declared fields, by field name (a list answers only the fields it was asked). */
    readonly values: Readonly<Record<string, unknown>>
}

/**
 * Why a record tool refuses a call. Business (the node or its agent reads it and goes on): `type_unknown` (no installed package declares
 * the type), `not_found` (no such record of the calling agent in the workspace: a record of another agent or workspace answers the
 * same), `invalid_value` (the values break the type's own field declarations), `taken` (a declared unique or
 * no-overlap constraint holds another record), `stale` (the record changed since the version the call named), `query_invalid` (the
 * filter, order or cursor does not fit the type), `query_not_indexed` (no declared index serves the filter and order). Infrastructure
 * (the step freezes and is reported): `type_read_only` (the template declares a write on a projection only its jobs write),
 * `not_served` (this app binds no record store).
 */
export type RecordRefusalReason =
    | "type_unknown"
    | "not_found"
    | "invalid_value"
    | "taken"
    | "stale"
    | "query_invalid"
    | "query_not_indexed"
    | "type_read_only"
    | "not_served"
