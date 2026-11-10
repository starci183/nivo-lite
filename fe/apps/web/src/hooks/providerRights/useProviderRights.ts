"use client"

import {
    fakeAttachAgentProvider,
    fakeDetachAgentProvider,
    fakeSetAgentAbility,
    useFakeProviderRights,
} from "./fakeProviderRights"
import { fakeAgentAbilityProposal } from "./fakeAgentAbilityProposal"
import type { AbilityMode, HeldAbilityWire, ProviderWire } from "./providerRights.types"

/** One provider an agent holds with what it has ticked. */
export interface HeldProvider {
    readonly provider: ProviderWire
    readonly held: ReadonlyArray<HeldAbilityWire>
}

/** The providers one agent holds, the ones it could still hold, and the commands that change them. */
export interface AgentProviderRights {
    readonly attached: ReadonlyArray<HeldProvider>
    /** Connected providers with at least one ability that the agent does not hold yet. */
    readonly attachable: ReadonlyArray<ProviderWire>
    readonly attach: (provider: string) => Promise<void>
    readonly detach: (provider: string) => Promise<void>
    readonly setAbility: (provider: string, ability: string, mode: AbilityMode) => Promise<void>
}

/**
 * `providerRights` for one agent with `attachAgentProvider`, `detachAgentProvider` and `setAgentAbility`. Attaching ticks what the template
 * proposes for the provider (`agentAbilityProposal`), else nothing. FAKE SOURCE today (`fakeProviderRights.ts`); the swap is those imports.
 */
export const useProviderRights = (agentId: string, moduleKey: string): AgentProviderRights => {
    const rights = useFakeProviderRights(agentId, moduleKey)
    const attached = rights.attachments.flatMap((attachment) => {
        const provider = rights.providers.find((one) => one.provider === attachment.provider)
        return provider === undefined ? [] : [{ provider, held: attachment.abilities }]
    })
    const taken = new Set(attached.map((one) => one.provider.provider))
    return {
        attached,
        attachable: rights.providers.filter((one) => one.connected && one.abilities.length > 0 && !taken.has(one.provider)),
        attach: (provider) => {
            const proposed = fakeAgentAbilityProposal(moduleKey).find((row) => row.provider === provider)
            return fakeAttachAgentProvider(agentId, moduleKey, provider, proposed?.abilities ?? [])
        },
        detach: (provider) => fakeDetachAgentProvider(agentId, moduleKey, provider),
        setAbility: (provider, ability, mode) => fakeSetAgentAbility(agentId, moduleKey, provider, ability, mode),
    }
}
