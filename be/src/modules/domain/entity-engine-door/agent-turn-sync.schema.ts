import { z } from "zod"

/** The most turns one history read carries, the bound of the gateway read. */
const TURNS_MAX = 1000

/** The input of the sync job: the agent and the session whose turns are copied. Ids only. */
export const SYNC_AGENT_TURNS_INPUT: z.ZodObject<{ agentKey: z.ZodString; sessionKey: z.ZodString }> = z.object({
    agentKey: z
        .string()
        .min(1)
        .max(64)
        .regex(/^[a-z][a-z0-9-]*$/u),
    sessionKey: z.string().min(1).max(200),
})

/** What the door tool `ai.agent.history` answers: the turns of the session, oldest first. */
export const HISTORY_OUTPUT_SCHEMA: z.ZodType<{
    readonly turns: ReadonlyArray<{
        readonly index: number
        readonly role: "user" | "assistant" | "tool" | "system"
        readonly text: string
        readonly toolCalls: ReadonlyArray<{ readonly name: string; readonly argsJson: string }>
        readonly at: string
    }>
}> = z.object({
    turns: z
        .array(
            z.object({
                index: z
                    .number()
                    .int()
                    .min(0)
                    .max(TURNS_MAX * 10),
                role: z.enum(["user", "assistant", "tool", "system"]),
                text: z.string().max(20_000),
                toolCalls: z.array(z.object({ name: z.string().max(200), argsJson: z.string().max(20_000) })).max(50),
                at: z.string().max(40),
            }),
        )
        .max(TURNS_MAX),
})
