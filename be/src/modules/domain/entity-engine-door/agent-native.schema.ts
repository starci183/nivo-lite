import { z } from "zod"
import type { GatewayJson } from "@modules/domain/mcp-gateway"

/** The module key of an agent: lower-case words, the part of its OpenClaw id the workspace does not fix. */
const agentKey = z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9-]*$/u)

/** The bounded arguments of `agent.turn`: one message to the agent in one session. */
export const AGENT_TURN_SCHEMA: z.ZodType<{
    readonly agentKey: string
    readonly sessionKey: string
    readonly message: string
    readonly timeoutMs?: number | undefined
    readonly idempotencyKey?: string | undefined
}> = z
    .object({
        agentKey,
        sessionKey: z.string().min(1).max(200),
        message: z.string().min(1).max(20_000),
        timeoutMs: z.number().int().min(1000).max(300_000).optional(),
        idempotencyKey: z.string().min(1).max(200).optional(),
    })
    .strict()

/** The bounded arguments of `agent.history`: the session whose turns are read. */
export const AGENT_HISTORY_SCHEMA: z.ZodType<{ readonly agentKey: string; readonly sessionKey: string }> = z
    .object({ agentKey, sessionKey: z.string().min(1).max(200) })
    .strict()

/** The schema `agent.turn` announces, generated from its validator. */
export const AGENT_TURN_INPUT_SCHEMA: GatewayJson = z.toJSONSchema(AGENT_TURN_SCHEMA, { io: "input" })

/** The schema `agent.history` announces, generated from its validator. */
export const AGENT_HISTORY_INPUT_SCHEMA: GatewayJson = z.toJSONSchema(AGENT_HISTORY_SCHEMA, { io: "input" })
