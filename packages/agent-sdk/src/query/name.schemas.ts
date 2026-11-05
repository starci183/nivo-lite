import { z } from "zod"
import { ENTITY_PATTERN, FIELD_PATTERN, IDENT_PATTERN, QUERY_LIMITS } from "./query-bounds"

/** A field name: a declared or system field, or `<jsonbField>.<key>`. */
export const fieldName: z.ZodString = z.string().min(1).max(QUERY_LIMITS.name).regex(FIELD_PATTERN)
/** A relation or measure name. */
export const identName: z.ZodString = z.string().min(1).max(QUERY_LIMITS.name).regex(IDENT_PATTERN)
/** An entity name. */
export const entityName: z.ZodString = z.string().min(1).max(QUERY_LIMITS.name).regex(ENTITY_PATTERN)
