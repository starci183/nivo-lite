import type { LeadWait } from "@modules/domain/promo"
import type { LeadWaitRequest } from "../../application/lead-wait.contracts"
import type { LeadWaitInput } from "./dto/lead-wait.input"
import type { LeadWaitType } from "./dto/lead-wait.type"

/** Maps the workspace selector and bounded input to the application request. */
export const toLeadWaitRequest = (workspaceId: string, input: LeadWaitInput): LeadWaitRequest => ({
    workspaceId,
    leadId: input.leadId,
})

/** Maps the service result to its GraphQL output. */
export const toLeadWaitType = (result: LeadWait): LeadWaitType => ({ ...result })
