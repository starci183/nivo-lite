import { z } from "zod"

/** What the `lead.ensure` effect asks for: the conversation whose customer is the lead, and what the chat knows of them. */
export const ensurePayload: z.ZodObject<
    {
        conversationId: z.ZodString
        name: z.ZodOptional<z.ZodString>
        phone: z.ZodOptional<z.ZodString>
        channel: z.ZodString
    },
    z.core.$strip
> = z.object({
    conversationId: z.string().min(1).max(500),
    name: z.string().min(1).max(500).optional(),
    phone: z.string().min(1).max(500).optional(),
    channel: z.string().min(1).max(500),
})

/** The payload of the `lead.ensure` effect, once read. */
export type EnsurePayload = z.infer<typeof ensurePayload>
