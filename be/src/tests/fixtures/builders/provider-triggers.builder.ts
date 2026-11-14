import { builder } from "@starci/jest-preset"
import { providerTriggersEntities } from "@modules/domain/provider-triggers"

const ProviderTriggerSwitchEntity: (typeof providerTriggersEntities)[0] = providerTriggersEntities[0]
type ProviderTriggerSwitchEntity = InstanceType<typeof ProviderTriggerSwitchEntity>

/** The bank trigger's switch of account conn-1 in workspace ws-1: on since 03:00, never fired, no decider bound. */
export const switchRowOf: (overrides?: Partial<ProviderTriggerSwitchEntity>) => ProviderTriggerSwitchEntity =
    builder<ProviderTriggerSwitchEntity>({
        id: "switch-1",
        workspaceId: "ws-1",
        connectionId: "conn-1",
        triggerName: "transaction.received",
        enabled: true,
        enabledAt: new Date("2026-11-12T03:00:00Z"),
        deciderAgentId: null,
        lastFiredAt: null,
        firedCount: 0,
        createdAt: new Date("2026-11-12T02:00:00Z"),
        updatedAt: new Date("2026-11-12T02:00:00Z"),
    })
