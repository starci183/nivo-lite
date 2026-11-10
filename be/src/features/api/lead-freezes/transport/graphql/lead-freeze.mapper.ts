import type { DecideLeadFreezeRequest, ReadLeadFreezeRequest } from "../../application/lead-freeze.contracts"
import type { Locale } from "@modules/platform/i18n"
import type { DecideLeadFreezeInput, LeadFreezeInput } from "./dto/lead-freeze.input"

/** Maps the GraphQL input of the read to the request. */
export const toReadLeadFreezeRequest = (workspaceId: string, input: LeadFreezeInput): ReadLeadFreezeRequest => ({
    workspaceId,
    leadId: input.leadId,
    runId: input.runId,
})

/** Maps the GraphQL input of the answer to the request. */
export const toDecideLeadFreezeRequest = (
    workspaceId: string,
    locale: Locale,
    input: DecideLeadFreezeInput,
): DecideLeadFreezeRequest => ({ workspaceId, freezeId: input.freezeId, action: input.action, locale })
