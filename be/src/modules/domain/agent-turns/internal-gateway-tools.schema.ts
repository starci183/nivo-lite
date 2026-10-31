import { z } from "zod"
import { gatewayToolNameSchema } from "@modules/domain/mcp-gateway"

/** The largest encoded argument object accepted by the bridge. */
export const ARGUMENTS_JSON_MAX = 65_536

/** What `tool.call` takes from a turn with no conversation: the connector tool's full name and its arguments as JSON text. */
export const internalCallSchema = z.strictObject({
    name: gatewayToolNameSchema,
    arguments_json: z.string().max(ARGUMENTS_JSON_MAX).optional(),
})
