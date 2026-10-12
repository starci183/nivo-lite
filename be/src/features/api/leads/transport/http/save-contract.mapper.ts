import type { SaveContractRequest, SaveContractResult } from "../../application/save-contract.contracts"
import type { SaveContractRequest as SaveContractHttpRequest } from "./dto/save-contract.request"
import type { SaveContractResponse } from "./dto/save-contract.response"

/** Maps the HTTP request, the workspace and the request language to the command request. */
export const toSaveContractRequest = (
    workspaceId: string,
    input: SaveContractHttpRequest,
    acceptLanguage: string | undefined,
): SaveContractRequest => ({
    contractId: input.contractId,
    leadId: input.leadId,
    customerName: input.customerName,
    plan: input.plan,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    amountVnd: input.amountVnd,
    status: input.status,
    note: input.note,
    workspaceId,
    acceptLanguage,
})

/** Maps the command result to the HTTP response. */
export const toSaveContractResponse = (result: SaveContractResult): SaveContractResponse => ({
    id: result.id,
    leadId: result.leadId,
    customerName: result.customerName,
    plan: result.plan,
    startsOn: result.startsOn,
    endsOn: result.endsOn,
    amountVnd: result.amountVnd,
    status: result.status,
    note: result.note,
})
