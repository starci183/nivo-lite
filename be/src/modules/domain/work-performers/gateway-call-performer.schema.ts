import { z } from "zod"

/** The durable approval linkage needed before the performer yields execution to a run. */
export const gatewayApprovalWaitSchema: z.ZodObject<
    {
        workItemId: z.ZodString
        scope: z.ZodObject<
            {
                conversationId: z.ZodString
            },
            z.core.$strip
        >
    },
    z.core.$strip
> = z.object({
    workItemId: z.string().min(1).max(500),
    scope: z.object({ conversationId: z.string().min(1).max(500) }),
})
