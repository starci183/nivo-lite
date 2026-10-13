import { Module } from "@nestjs/common"
import { LeadsApiModule } from "../../leads.module"
import { AddResponsibilityResolver } from "./add-responsibility.resolver"
import { AssignResponsibilityResolver } from "./assign-responsibility.resolver"
import { RecordOutcomeResolver } from "./record-outcome.resolver"
import { SaveContractResolver } from "./save-contract.resolver"

@Module({
    imports: [LeadsApiModule],
    providers: [RecordOutcomeResolver, AddResponsibilityResolver, AssignResponsibilityResolver, SaveContractResolver],
})
/** GraphQL transport for lead outcomes, responsibilities and recurring contracts. */
export class LeadsGraphqlModule {}
