import { z } from "zod"
import { GATEWAY_ARGUMENT_LIMITS, isAdmissibleArgumentTree } from "./gateway-arguments.policy"
import type { GatewayArgument, GatewayJson } from "./mcp-gateway.contracts"

/** The validator type carried by native tool manifests. */
export type GatewayArgumentSchema = z.ZodType<GatewayJson>

/** A generated JSON Schema node advertised by a tool. */
export type GatewayInputSchema = z.core.JSONSchema.JSONSchema

const gatewayScalarSchema = z.union([z.string().max(GATEWAY_ARGUMENT_LIMITS.string), z.number(), z.boolean(), z.null()])

/** A JSON value whose every collection has a count bound; the arguments schema admits only trees within the depth budget. */
const gatewayValueSchema: z.ZodType<GatewayArgument> = z.lazy(() =>
    z.union([gatewayScalarSchema, z.array(gatewayValueSchema).max(GATEWAY_ARGUMENT_LIMITS.items), gatewayRecordSchema]),
)

/** The refinement and metadata enforce and advertise the record budget; the key pattern advertises the refused `__proto__`. */
const gatewayRecordSchema = z
    .record(
        z
            .string()
            .max(GATEWAY_ARGUMENT_LIMITS.key)
            .regex(/^(?!__proto__$)/u),
        gatewayValueSchema,
    )
    .refine((record) => Object.keys(record).length <= GATEWAY_ARGUMENT_LIMITS.properties)
    .meta({ maxProperties: GATEWAY_ARGUMENT_LIMITS.properties })

/** Bounded JSON arguments, without accepting arbitrary JavaScript values or an unbounded recursive tree. */
export const gatewayArgumentsSchema = z
    .preprocess((input: unknown) => (isAdmissibleArgumentTree(input) ? input : undefined), gatewayRecordSchema)
    .refine((args) => JSON.stringify(args).length <= GATEWAY_ARGUMENT_LIMITS.json)

/** The longest full name accepted by the gateway's connector/tool grammar is 31 + 1 + 81 characters. */
export const gatewayToolNameSchema = z.string().min(1).max(113)

/** Discovery requires a query; an empty query lists the caller's granted tools. */
export const gatewaySearchSchema = z.strictObject({
    query: z.string().max(200),
    limit: z.number().int().min(1).max(10).optional(),
})

/** Describing a tool requires its full name. */
export const gatewayDescribeSchema = z.strictObject({ name: gatewayToolNameSchema })

/** Calling a connector requires its name; omitted arguments mean an empty object. */
export const gatewayCallSchema = z.strictObject({
    name: gatewayToolNameSchema,
    arguments: gatewayArgumentsSchema.optional(),
    opKey: z.string().max(200).optional(),
})

/** Parsed arguments of the agent endpoint's tool.call. */
export type GatewayCall = z.infer<typeof gatewayCallSchema>

/** The schemas advertised by tools/list are generated from the validators used by tools/call. */
export const GATEWAY_SEARCH_INPUT_SCHEMA = z.toJSONSchema(gatewaySearchSchema, { reused: "ref" })
export const GATEWAY_DESCRIBE_INPUT_SCHEMA = z.toJSONSchema(gatewayDescribeSchema, { reused: "ref" })
export const GATEWAY_CALL_INPUT_SCHEMA = z.toJSONSchema(gatewayCallSchema, { reused: "ref" })
