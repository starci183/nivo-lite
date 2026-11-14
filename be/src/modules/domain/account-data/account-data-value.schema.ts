import { z } from "zod"
import { isJsonValue } from "./account-data.policy"

/** A `text` member: at most 1 MiB characters unless its declaration bounds it tighter (`maxLength`). */
export const ACCOUNT_TEXT: z.ZodString = z.string().max(1_048_576)

/** An `integer` member: a safe integer. */
export const ACCOUNT_INTEGER: z.ZodInt = z.int()

/** A `number` member: a finite number. */
export const ACCOUNT_NUMBER: z.ZodNumber = z.number()

/** A `boolean` member. */
export const ACCOUNT_BOOLEAN: z.ZodBoolean = z.boolean()

/** A `timestamp` member: ISO text with `Z` or a `+hh:mm` offset that parses (the generated CHECK reads the same form). */
export const ACCOUNT_TIMESTAMP: z.ZodType<string> = z
    .string()
    .max(40)
    .regex(/^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:\d{2})$/)
    .refine((text) => !Number.isNaN(Date.parse(text)))

/** A `json` member: any JSON value but null at its top; its size is the type's `maxBytes`. */
export const ACCOUNT_JSON: z.ZodType<unknown> = z.custom<unknown>((value) => value !== null && isJsonValue(value))

/** The value of a type before its members are added: exactly the declared members, nothing else (strict). */
export const ACCOUNT_VALUE: z.ZodObject<Record<never, never>, z.core.$strict> = z.strictObject({})

/** The schema of one member. */
export type AccountMemberSchema = z.ZodType

/** The schema of a type's values. */
export type AccountValueSchema = z.ZodType<Record<string, unknown>>
