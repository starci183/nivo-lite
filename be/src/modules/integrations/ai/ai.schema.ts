import { z } from "zod"
import type { ZodType } from "zod"

/** The shape a JSON answer is parsed into by structured output. */
export type AiSchema = ZodType

/** Any JSON object: the shape of a JSON prompt that names no schema of its own. */
export const ANY_OBJECT: AiSchema = z.looseObject({})
