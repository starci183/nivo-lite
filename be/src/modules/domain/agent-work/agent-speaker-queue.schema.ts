import { z } from "zod"
import type { StoredTag } from "./agent-speaker-queue.contracts"

/** The hand-off a queue row keeps: the request of an agent's tag, its plain data kept as JSON text the way a wake keeps it. */
export const storedTagSchema: z.ZodType<StoredTag> = z.object({
    workspaceId: z.string().min(1).max(64),
    fromAgentId: z.string().min(1).max(64),
    toAgentId: z.string().min(1).max(64),
    text: z.string().max(20_000),
    conversationId: z.string().min(1).max(64),
    eventKey: z.string().min(1).max(500),
    subject: z.string().max(500).nullish(),
    channel: z.string().max(64).nullish(),
    leadId: z.string().max(64).nullish(),
    locale: z.enum(["vi", "en"]).optional(),
    contextJson: z.string().max(8000).optional(),
    visibility: z.enum(["chat", "redirect"]).optional(),
})
