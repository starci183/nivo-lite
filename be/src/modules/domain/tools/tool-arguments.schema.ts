import { z } from "zod"
import { TOOL_ARGUMENT_LIMITS, isAdmissibleArgumentTree } from "./tool-arguments.policy"
import type { ToolArgument, ToolJson } from "./tools.contracts"

/** The validator type carried by native tool manifests. */
export type ToolArgumentSchema = z.ZodType<ToolJson>

/** A generated JSON Schema node advertised by a tool. */
export type ToolInputSchema = z.core.JSONSchema.JSONSchema

const gatewayScalarSchema = z.union([z.string().max(TOOL_ARGUMENT_LIMITS.string), z.number(), z.boolean(), z.null()])

/** A JSON value whose every collection has a count bound; the arguments schema admits only trees within the depth budget. */
const gatewayValueSchema: z.ZodType<ToolArgument> = z.lazy(() =>
    z.union([gatewayScalarSchema, z.array(gatewayValueSchema).max(TOOL_ARGUMENT_LIMITS.items), gatewayRecordSchema]),
)

/** The refinement and metadata enforce and advertise the record budget; the key pattern advertises the refused `__proto__`. */
const gatewayRecordSchema = z
    .record(
        z
            .string()
            .max(TOOL_ARGUMENT_LIMITS.key)
            .regex(/^(?!__proto__$)/u),
        gatewayValueSchema,
    )
    .refine((record) => Object.keys(record).length <= TOOL_ARGUMENT_LIMITS.properties)
    .meta({ maxProperties: TOOL_ARGUMENT_LIMITS.properties })

/** Bounded JSON arguments, without accepting arbitrary JavaScript values or an unbounded recursive tree. */
export const toolArgumentsSchema: z.ZodPreprocess<
    z.ZodRecord<z.ZodString, z.ZodType<ToolArgument, unknown, z.core.$ZodTypeInternals<ToolArgument, unknown>>>,
    unknown
> = z
    .preprocess((input: unknown) => (isAdmissibleArgumentTree(input) ? input : undefined), gatewayRecordSchema)
    .refine((args) => JSON.stringify(args).length <= TOOL_ARGUMENT_LIMITS.json)
