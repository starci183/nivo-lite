import type { SaveContractRequest, SaveContractResult } from "../../application/save-contract.contracts"
import type { SaveContractInput } from "./dto/save-contract.input"
import type { SaveContractType } from "./dto/save-contract.type"

/** Maps the input and request context to the recurring contract command. */
export const toSaveContractRequest = (
    workspaceId: string,
    input: SaveContractInput,
    acceptLanguage: string,
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

/** Maps the saved recurring contract to the GraphQL type. */
export const toSaveContractType = (result: SaveContractResult): SaveContractType => ({ ...result })
