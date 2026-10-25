import { z } from "zod"
import { gatewayArgumentsSchema, gatewayToolNameSchema } from "@modules/domain/mcp-gateway"

/** The largest encoded argument object accepted by the OpenClaw bridge. */
const ARGUMENTS_JSON_MAX = 65536
/** One approved playbook names at most ten connector calls. */
const STEPS_MAX = 10
/** The bridge accepts the same bounded call arguments as the MCP endpoint. */
export const turnGatewayCallSchema = z.strictObject({
    name: gatewayToolNameSchema,
    arguments_json: z.string().max(ARGUMENTS_JSON_MAX).optional(),
})

/** The encoded playbook and the customer reply that its approval carries. */
export const turnGatewaySequenceSchema = z.strictObject({
    steps_json: z.string().max(ARGUMENTS_JSON_MAX * STEPS_MAX),
    reply: z.string().max(2000).optional(),
})

/** Every decoded step keeps its full name and bounded JSON arguments without coercion. */
export const gatewaySequenceStepsSchema = z
    .array(z.strictObject({ name: gatewayToolNameSchema, arguments: gatewayArgumentsSchema.optional() }))
    .min(1)
    .max(STEPS_MAX)
