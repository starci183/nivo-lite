import { QueryHandler } from "@nestjs/cqrs"
import { ContractImportService } from "@modules/domain/data-hub"
import type { ContractImportPreview } from "@modules/domain/data-hub"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PreviewContractImportQuery } from "./preview-contract-import.query"

@QueryHandler(PreviewContractImportQuery)
/** Previews a contract sheet through the ContractImportService. */
export class PreviewContractImportHandler extends ICQRSHandler<PreviewContractImportQuery, ContractImportPreview> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly contractImport: ContractImportService,
    ) {
        super(logger)
    }

    protected override process(query: PreviewContractImportQuery): Promise<ContractImportPreview> {
        return this.contractImport.preview({ ...query.params.request, userId: query.params.principal.id })
    }
}
