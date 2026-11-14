import type { ZodType } from "zod"

/** A schema the node host's core door parses a guided model answer with. */
export type NodeAnswerSchema<T> = ZodType<T>
