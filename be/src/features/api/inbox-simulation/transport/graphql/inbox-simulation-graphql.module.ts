import { Module } from "@nestjs/common"
import { InboxSimulationApiModule } from "../../inbox-simulation.module"
import { ConfigurableModuleClass } from "./inbox-simulation-graphql.module-definition"
import { SimulateInboundResolver } from "./simulate-inbound.resolver"
import { InboundSimulationStatusResolver } from "./get-inbound-simulation-status.resolver"

@Module({
    imports: [InboxSimulationApiModule.register({})],
    providers: [SimulateInboundResolver, InboundSimulationStatusResolver],
})
/** The GraphQL request and status transport of the Inbox simulator. */
export class InboxSimulationGraphqlModule extends ConfigurableModuleClass {}
