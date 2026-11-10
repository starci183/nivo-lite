import { Module } from "@nestjs/common"
import { BrainCriticApiModule } from "../../brain-critic.module"
import { ConfigurableModuleClass } from "./brain-critic-graphql.module-definition"
import { BrainCritiqueDecisionsResolver } from "./brain-critique-decisions.resolver"
import { BrainCritiqueResolver } from "./brain-critique.resolver"

@Module({
    imports: [BrainCriticApiModule.register({})],
    providers: [BrainCritiqueResolver, BrainCritiqueDecisionsResolver],
})
/** The GraphQL transport of the document critique. */
export class BrainCriticGraphqlModule extends ConfigurableModuleClass {}
