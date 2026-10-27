import { Module } from "@nestjs/common"
import { AddResponsibilityHandler } from "./application/add-responsibility.handler"
import { AssignResponsibilityHandler } from "./application/assign-responsibility.handler"
import { ImportContractsHandler } from "./application/import-contracts.handler"
import { PreviewContractImportHandler } from "./application/preview-contract-import.handler"
import { RecordOutcomeHandler } from "./application/record-outcome.handler"
import { SaveContractHandler } from "./application/save-contract.handler"
import { ConfigurableModuleClass } from "./leads.module-definition"

@Module({
    providers: [
        RecordOutcomeHandler,
        AddResponsibilityHandler,
        AssignResponsibilityHandler,
        SaveContractHandler,
        PreviewContractImportHandler,
        ImportContractsHandler,
    ],
})
/** The leads feature: the handlers of its application. */
export class LeadsApiModule extends ConfigurableModuleClass {}
