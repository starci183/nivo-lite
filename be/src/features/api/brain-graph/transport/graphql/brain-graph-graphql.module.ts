import { Module } from "@nestjs/common"
import { BrainGraphApiModule } from "../../brain-graph.module"
import { ConfigurableModuleClass } from "./brain-graph-graphql.module-definition"
import { GetBrainGraphResolver } from "./get-brain-graph.resolver"
import { LinkBrainFactsResolver } from "./link-brain-facts.resolver"
import { UnlinkBrainFactsResolver } from "./unlink-brain-facts.resolver"

@Module({
    imports: [BrainGraphApiModule.register({})],
    providers: [GetBrainGraphResolver, LinkBrainFactsResolver, UnlinkBrainFactsResolver],
})
/** The GraphQL transport of the truth graph feature. */
export class BrainGraphGraphqlModule extends ConfigurableModuleClass {}
