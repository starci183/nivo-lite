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
    /** Marks the slot as one a spec binds to a read. */
    readonly kind: "read"
    /** Whether the bound read yields one record or a list of them. */
    readonly shape: S
    /** A spec that leaves the slot unbound is refused. */
    readonly required: true
}

/** An action slot that a spec may leave unbound. */
export interface OptionalAction {
    /** Marks the slot as one a spec binds to a command. */
    readonly kind: "action"
    /** A spec may leave the slot unbound; the block then draws no control for it. */
    readonly required: false
}

/** An action slot that a spec must bind. */
export interface RequiredAction {
    /** Marks the slot as one a spec binds to a command. */
    readonly kind: "action"
    /** A spec that leaves the slot unbound is refused. */
    readonly required: true
}
