import { Module, type DynamicModule, type Provider } from "@nestjs/common"
// The decorators file, not the barrel: trigger-specs' policy imports this capability's barrel (no import ring).
import { TRIGGER_SWITCH_READER } from "@modules/domain/trigger-specs/trigger-specs.decorators"
import { ProviderTriggerStatesService } from "./provider-trigger-states.service"
import { ProviderTriggerStoreService } from "./provider-trigger-store.service"
import { PROVIDER_TRIGGER_AGENT_NAMES, PROVIDER_TRIGGER_DECIDER_READER } from "./provider-triggers.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./provider-triggers.module-definition"
import { DeliveredWakesService } from "./delivered-wakes.service"
import { ProviderTriggersService } from "./provider-triggers.service"

@Module({})
/**
 * Level 3 of a provider, over the primary PostgreSQL connection: the declared triggers, the switch of each on each account, and the
 * one emit point that hands an event to the registered workflows.
 */
export class ProviderTriggersModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app; the agent names port is bound only when the app root names its class. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        const agentNames = options.ports?.agentNames
        const ports: ReadonlyArray<Provider> =
            agentNames === undefined ? [] : [{ provide: PROVIDER_TRIGGER_AGENT_NAMES, useExisting: agentNames }]
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                ...ports,
                ProviderTriggerStoreService,
                ProviderTriggersService,
                DeliveredWakesService,
                ProviderTriggerStatesService,
                // The account trigger switches readiness reads (`TriggerSwitchReader`): the store's `listOf` has its shape.
                { provide: TRIGGER_SWITCH_READER, useExisting: ProviderTriggerStoreService },
                // The bound decider a provider's core path reads (`ProviderTriggerDeciderReader`): the store's own read of it.
                { provide: PROVIDER_TRIGGER_DECIDER_READER, useExisting: ProviderTriggerStoreService },
            ],
            exports: [
                ProviderTriggersService,
                DeliveredWakesService,
                ProviderTriggerStatesService,
                TRIGGER_SWITCH_READER,
                PROVIDER_TRIGGER_DECIDER_READER,
            ],
        }
    }
}
