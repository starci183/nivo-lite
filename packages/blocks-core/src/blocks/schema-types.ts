import type { SpecText } from "@nivo-lite/agent-sdk/schema"
import type { z } from "zod"

/** The zod type of a text prop. */
export type TextSchema = z.ZodType<SpecText>

/** The zod type of an enum prop over the given values. */
export type EnumSchema<V extends string> = z.ZodEnum<{ readonly [K in V]: K }>

/** The zod type of a list of term and path pairs. */
export type TermPathsSchema = z.ZodArray<z.ZodObject<{ term: TextSchema; path: z.ZodString }>>

/** A required read slot of the given shape. */
export interface RequiredRead<S extends "record" | "list"> {
    /** The slot reads data. */
    readonly kind: "read"
    /** Whether the slot reads one record or a list of them. */
    readonly shape: S
    /** A spec must bind the slot. */
    readonly required: true
}

/** An action slot that a spec may leave unbound. */
export interface OptionalAction {
    /** The slot runs an action. */
    readonly kind: "action"
    /** A spec may leave the slot unbound. */
    readonly required: false
}

/** An action slot that a spec must bind. */
export interface RequiredAction {
    /** The slot runs an action. */
    readonly kind: "action"
    /** A spec must bind the slot. */
    readonly required: true
}

/** The slots of a block that reads one record, named `data`. */
export type DataSlots = {
    /** The record the block draws. */
    readonly data: RequiredRead<"record">
}

/** The slots of a block that reads one record, named `region`. */
export type RegionSlots = {
    /** The region the block draws. */
    readonly region: RequiredRead<"record">
}

/** The slots of the decision queue: the queue it reads and the command it may run. */
export type QueueSlots = {
    /** The queue the block draws. */
    readonly queue: RequiredRead<"record">
    /** The command run on a row. */
    readonly command: OptionalAction
}

/** The slots of the record list: the rows it reads and the action it may run on one. */
export type RowsSlots = {
    /** The records the block lists. */
    readonly rows: RequiredRead<"list">
    /** The action run on a row. */
    readonly open: OptionalAction
}

/** The slots of the dashboard cards: one record per card. */
export type DashboardSlots = {
    /** What the agent finished. */
    readonly done: RequiredRead<"record">
    /** The connections the agent acts through. */
    readonly connections: RequiredRead<"record">
    /** What the agent knows. */
    readonly knowledge: RequiredRead<"record">
}

/** The slots of the explanation: the why, the two lists and the close action. */
export type ExplanationSlots = {
    /** The recorded explanation of the open work item. */
    readonly why: RequiredRead<"record">
    /** What waits for a person. */
    readonly waiting: RequiredRead<"record">
    /** What was done. */
    readonly done: RequiredRead<"record">
    /** The action that clears the open item. */
    readonly close: RequiredAction
}
