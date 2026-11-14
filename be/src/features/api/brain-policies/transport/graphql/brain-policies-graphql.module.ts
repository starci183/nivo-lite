import { Module } from "@nestjs/common"
import { BrainPoliciesApiModule } from "../../brain-policies.module"
import { ConfigurableModuleClass } from "./brain-policies-graphql.module-definition"
import { BrainPoliciesResolver } from "./brain-policies.resolver"

@Module({
    imports: [BrainPoliciesApiModule.register({})],
    providers: [BrainPoliciesResolver],
})
/** The GraphQL transport of the Policies tab. */
export class BrainPoliciesGraphqlModule extends ConfigurableModuleClass {}
