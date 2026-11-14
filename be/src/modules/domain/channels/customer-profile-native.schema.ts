import { z } from "zod"
import type { ToolJson } from "@modules/domain/tools"

/**
 * `nivo.tool.customer.profile.get` on the gateway: the channel account (a connection of the workspace) and the channel's own id of the
 * person on it (the identity a contact holds, as the event's subject names it). Nothing else: no contact, no route, no record.
 */
export const CUSTOMER_PROFILE_GET_SCHEMA = z
    .object({
        accountId: z.string().min(1).max(200),
        personId: z.string().min(1).max(200),
    })
    .strict()

/** The input schema the connector advertises: the same, as JSON Schema. */
export const CUSTOMER_PROFILE_GET_INPUT_SCHEMA: ToolJson = z.toJSONSchema(CUSTOMER_PROFILE_GET_SCHEMA, { io: "input" })
