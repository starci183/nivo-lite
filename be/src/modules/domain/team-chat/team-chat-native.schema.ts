import { z } from "zod"
import type { ToolJson } from "@modules/domain/tools"

const id = z.string().min(1).max(200)

/** The bounded arguments of `nivo.tool.team-chat.report.post`. */
export const POST_REPORT_SCHEMA: z.ZodType<{
    readonly runId: string
    readonly agentId: string
    readonly trigger: string
}> = z.object({ runId: z.uuid(), agentId: z.uuid(), trigger: id }).strict()

/** The schema `nivo.tool.team-chat.report.post` announces. */
export const POST_REPORT_INPUT_SCHEMA: ToolJson = z.toJSONSchema(POST_REPORT_SCHEMA, { io: "input" })
