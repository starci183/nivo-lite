import { ProviderTriggerDeadEventEntity } from "./provider-trigger-dead-event.entity"
import { ProviderTriggerSwitchEntity } from "./provider-trigger-switch.entity"

export { ProviderTriggerDeadEventEntity, ProviderTriggerSwitchEntity }

/** Every entity the provider-triggers capability owns, collected by the database connection. */
export const providerTriggersEntities: readonly [typeof ProviderTriggerSwitchEntity, typeof ProviderTriggerDeadEventEntity] = [
    ProviderTriggerSwitchEntity,
    ProviderTriggerDeadEventEntity,
] as const
