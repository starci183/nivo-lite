import type { NodeQuery, ReadScope, SubjectRef } from "@nivo-lite/agent-sdk/node"
import type { FilterExpr, Query } from "@nivo-lite/agent-sdk/query"

/** The part of a node turn the bridge reads: the workspace, the record the turn is about and the conversation it serves. */
export interface EntityNodeTurn {
    /** The workspace that scopes every read. */
    readonly workspaceId: string
    /** The record the turn is about, or null. */
    readonly subject: SubjectRef | null
    /** The customer conversation the turn serves, or null. */
    readonly conversationId: string | null
}

/** One row a node read answers: only the fields asked, a field the record does not hold as null. */
export interface EntityNodeRow {
    /** One field by name. */
    readonly [field: string]: unknown
}

/** The rows a node read answers. */
export type EntityNodeRows = ReadonlyArray<EntityNodeRow>

/** The data port of one engine entity, as the graph node host registers it for the entity's data kind. */
export interface EntityNodePort {
    /** The data kind it serves. */
    readonly kind: string
    /** Reads the rows of the query, cut to its fields; the host has already checked the rights. */
    read(turn: EntityNodeTurn, query: NodeQuery, scope: ReadScope): Promise<EntityNodeRows>
}

/** How a turn-scoped read reaches the turn's record: the record is the entity's own, or a relation of the entity links to it. */
export interface TurnPath {
    /** The relation that links the entity to the record; null when the record is of the entity itself. */
    readonly relation: string | null
    /** The id of the record the turn is about. */
    readonly id: string
}

/** The statement a node read runs and how its rows are kept. */
export interface NodeReadPlan {
    /** The list query over the entity. */
    readonly query: Query
    /** The relation joined to test the turn's record in memory, or null when the filter already holds it. */
    readonly via: string | null
    /** The id the joined record must have when `via` is set. */
    readonly anchor: string
    /** The most rows the read answers. */
    readonly limit: number
}

/** The condition of a list query, absent when it has none. */
export interface NodeCondition {
    /** The filter, when the query names one. */
    readonly where?: FilterExpr
}
