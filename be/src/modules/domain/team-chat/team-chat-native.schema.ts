import { z } from "zod"
import type { GatewayJson } from "@modules/domain/mcp-gateway"

const id = z.string().min(1).max(200)

/** The bounded arguments of `team-chat.post-report`. */
export const POST_REPORT_SCHEMA: z.ZodType<{
    readonly runId: string
    readonly agentId: string
    readonly trigger: string
}> = z.object({ runId: z.uuid(), agentId: z.uuid(), trigger: id }).strict()

/** The bounded arguments of `team-chat.post-approval`. */
export const POST_APPROVAL_SCHEMA: z.ZodType<{ readonly decisionId: string }> = z
    .object({ decisionId: z.uuid() })
    .strict()

/** The schema `team-chat.post-report` announces. */
export const POST_REPORT_INPUT_SCHEMA: GatewayJson = z.toJSONSchema(POST_REPORT_SCHEMA, { io: "input" })

/** The schema `team-chat.post-approval` announces. */
export const POST_APPROVAL_INPUT_SCHEMA: GatewayJson = z.toJSONSchema(POST_APPROVAL_SCHEMA, { io: "input" })
