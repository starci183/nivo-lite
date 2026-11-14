import { Module } from "@nestjs/common"
import { BindProviderTriggerDeciderHandler } from "./application/bind-provider-trigger-decider.handler"
import { GetProviderTriggerStatesHandler } from "./application/get-provider-trigger-states.handler"
import { SetProviderTriggerEnabledHandler } from "./application/set-provider-trigger-enabled.handler"
import { ConfigurableModuleClass } from "./provider-triggers.module-definition"

@Module({
    providers: [GetProviderTriggerStatesHandler, SetProviderTriggerEnabledHandler, BindProviderTriggerDeciderHandler],
})
/** The provider triggers feature: the trigger card of a provider page, its switches and its decider. */
export class ProviderTriggersApiModule extends ConfigurableModuleClass {}
