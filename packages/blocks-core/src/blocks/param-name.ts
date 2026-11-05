import { z } from "zod"

/** The longest name of a spec param: a key of the `params` map of a workbench spec. */
export const PARAM_NAME_MAX = 64

/** The zod type of a prop that names a spec param. */
export type ParamNameSchema = z.ZodString

/** A prop that names a spec param; the block lists the prop in its `params`, so the spec checks the name exists. */
export const paramName: ParamNameSchema = z.string().min(1).max(PARAM_NAME_MAX)
