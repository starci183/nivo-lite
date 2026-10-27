import { Command } from "@nestjs/cqrs"
import type { ContractImportResult } from "@modules/domain/data-hub"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ImportContractsRequest } from "./import-contracts.contracts"

/** Saves every valid row of a contract sheet as a recurring contract of the caller's workspace. */
export class ImportContractsCommand extends Command<ContractImportResult> {
    constructor(readonly params: ExecuteParams<ImportContractsRequest>) {
        super()
    }
}
