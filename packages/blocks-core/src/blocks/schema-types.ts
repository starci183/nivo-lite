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
    readonly kind: "read"
    readonly shape: S
    readonly required: true
}

/** An action slot that a spec may leave unbound. */
export interface OptionalAction {
    readonly kind: "action"
    readonly required: false
}

/** An action slot that a spec must bind. */
export interface RequiredAction {
    readonly kind: "action"
    readonly required: true
}
