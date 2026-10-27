import { Query } from "@nestjs/cqrs"
import type { ContractImportPreview } from "@modules/domain/data-hub"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { PreviewContractImportRequest } from "./preview-contract-import.contracts"

/** Reads a contract sheet and answers its headers, a suggested mapping and the first rows judged. */
export class PreviewContractImportQuery extends Query<ContractImportPreview> {
    constructor(readonly params: ExecuteParams<PreviewContractImportRequest>) {
        super()
    }
}
