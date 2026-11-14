import type { z } from "zod"

/** A zod type of a node's params, input or output, as the node declares it. */
export type NodeSchema<Out, In = Out> = z.ZodType<Out, In>

/** The product languages a node writes customer text in. */
export type NodeLocale = "vi" | "en"

/** A record the host wrote, told by its kind and id. */
export interface RecordRef {
    /** The kind of the record: the effect that wrote it. */
    readonly kind: string
    /** The id the host gave it. */
    readonly id: string
}
