import type { z } from "zod"

/** A zod type of a node's params, input or output, as the node declares it. */
export type NodeSchema<Out, In = Out> = z.ZodType<Out, In>

/** The product languages a node writes customer text in. */
export type NodeLocale = "vi" | "en"
