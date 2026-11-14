import { Module } from "@nestjs/common"
import { ProviderTriggersApiModule } from "../../provider-triggers.module"
import { BindProviderTriggerDeciderResolver } from "./bind-provider-trigger-decider.resolver"
import { GetProviderTriggerStatesResolver } from "./get-provider-trigger-states.resolver"
import { ConfigurableModuleClass } from "./provider-triggers-graphql.module-definition"
import { SetProviderTriggerEnabledResolver } from "./set-provider-trigger-enabled.resolver"

@Module({
    imports: [ProviderTriggersApiModule.register({})],
    providers: [GetProviderTriggerStatesResolver, SetProviderTriggerEnabledResolver, BindProviderTriggerDeciderResolver],
})
/** The GraphQL transport of the provider triggers: the trigger card of a provider page. */
export class ProviderTriggersGraphqlModule extends ConfigurableModuleClass {}
