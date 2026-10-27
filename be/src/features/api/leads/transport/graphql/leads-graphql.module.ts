import { Module } from "@nestjs/common"
import { LeadsApiModule } from "../../leads.module"
import { AddResponsibilityResolver } from "./add-responsibility.resolver"
import { AssignResponsibilityResolver } from "./assign-responsibility.resolver"
import { ImportContractsResolver } from "./import-contracts.resolver"
import { ConfigurableModuleClass } from "./leads-graphql.module-definition"
import { PreviewContractImportResolver } from "./preview-contract-import.resolver"
import { RecordOutcomeResolver } from "./record-outcome.resolver"
import { SaveContractResolver } from "./save-contract.resolver"

@Module({
    imports: [LeadsApiModule.register({})],
    providers: [
        RecordOutcomeResolver,
        AddResponsibilityResolver,
        AssignResponsibilityResolver,
        SaveContractResolver,
        PreviewContractImportResolver,
        ImportContractsResolver,
    ],
})
/** GraphQL transport for lead outcomes, responsibilities, recurring contracts and their bulk import. */
export class LeadsGraphqlModule extends ConfigurableModuleClass {}
