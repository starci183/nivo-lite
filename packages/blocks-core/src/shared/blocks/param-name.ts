import { z } from "zod"

/** The longest name of a spec param: a key of the `params` map of a workbench spec. */
export const PARAM_NAME_MAX = 64

/** The zod type of a prop that names a spec param. */
export type ParamNameSchema = z.ZodString

/**
 * A prop that names a spec param: letters and digits, starting with a letter, as the spec validator of the SDK accepts a param
 * name. The block lists the prop in its `params`, so the spec checks the name is declared.
 */
export const paramName: ParamNameSchema = z
    .string()
    .regex(/^[a-zA-Z][a-zA-Z0-9]*$/)
    .max(PARAM_NAME_MAX)
