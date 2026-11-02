import { z } from "zod"

/** The durable approval linkage needed before the performer yields execution to a run. */
export const gatewayApprovalWaitSchema = z.object({
    workItemId: z.string().min(1).max(500),
    scope: z.object({ conversationId: z.string().min(1).max(500) }),
})
