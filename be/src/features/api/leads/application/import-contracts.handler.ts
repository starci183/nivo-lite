import { CommandHandler } from "@nestjs/cqrs"
import { ContractImportService } from "@modules/domain/data-hub"
import type { ContractImportResult } from "@modules/domain/data-hub"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ImportContractsCommand } from "./import-contracts.command"

@CommandHandler(ImportContractsCommand)
/** Imports a contract sheet through the ContractImportService. */
export class ImportContractsHandler extends ICQRSHandler<ImportContractsCommand, ContractImportResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly contractImport: ContractImportService,
    ) {
        super(logger)
    }

    protected override process(command: ImportContractsCommand): Promise<ContractImportResult> {
        return this.contractImport.importContracts({ ...command.params.request, userId: command.params.principal.id })
    }
}
