import type { ContractImportResult } from "@modules/domain/data-hub"
import type { ImportContractsRequest } from "../../application/import-contracts.contracts"
import type { ImportContractsInput } from "./dto/import-contracts.input"
import type { ImportContractsType } from "./dto/import-contracts.type"

/** Maps the GraphQL arguments of importContracts and the request context to the request. */
export const toImportContractsRequest = (
    workspaceId: string,
    input: ImportContractsInput,
    acceptLanguage: string,
): ImportContractsRequest => ({
    workspaceId,
    ...input,
    acceptLanguage,
})

/** Maps the answer of importContracts to the GraphQL type. */
export const toImportContractsType = (result: ContractImportResult): ImportContractsType => result
