import type { ContractImportPreview } from "@modules/domain/data-hub"
import type { PreviewContractImportRequest } from "../../application/preview-contract-import.contracts"
import type { ContractImportPreviewType } from "./dto/contract-import-preview.type"
import type { PreviewContractImportInput } from "./dto/preview-contract-import.input"

/** Maps the GraphQL arguments of previewContractImport to the request. */
export const toPreviewContractImportRequest = (
    workspaceId: string,
    input: PreviewContractImportInput,
): PreviewContractImportRequest => ({
    workspaceId,
    ...input,
})

/** Maps the answer of previewContractImport to the GraphQL type. */
export const toContractImportPreviewType = (result: ContractImportPreview): ContractImportPreviewType => result
