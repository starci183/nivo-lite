import { Module } from "@nestjs/common"
import { LeadsApiModule } from "../../leads.module"
import { AddResponsibilityResolver } from "./add-responsibility.resolver"
import { AssignResponsibilityResolver } from "./assign-responsibility.resolver"
import { ConfigurableModuleClass } from "./leads-graphql.module-definition"
import { RecordOutcomeResolver } from "./record-outcome.resolver"
import { SaveContractResolver } from "./save-contract.resolver"

@Module({
    imports: [LeadsApiModule.register({})],
    providers: [RecordOutcomeResolver, AddResponsibilityResolver, AssignResponsibilityResolver, SaveContractResolver],
})
/** GraphQL transport for lead outcomes, responsibilities and recurring contracts. */
export class LeadsGraphqlModule extends ConfigurableModuleClass {}
