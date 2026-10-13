import type { LeadFlowView } from "@modules/domain/lead-views"
import type { LeadFlowRequest } from "../../application/lead-flow.contracts"
import type { LeadFlowInput } from "./dto/lead-flow.input"
import type { LeadFlowType } from "./dto/lead-flow.type"

/** Adds the selected workspace to the validated journey input. */
export const toLeadFlowRequest = (input: LeadFlowInput, workspaceId: string): LeadFlowRequest => ({
    workspaceId,
    leadId: input.leadId,
})

/** The domain journey already carries the public, typed view. */
export const toLeadFlowType = (result: LeadFlowView): LeadFlowType => result
