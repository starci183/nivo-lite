"use client"

import {
    useMutateAttachAgentProviderSwr,
    useMutateDetachAgentProviderSwr,
    useMutateSetAgentAbilitySwr,
    useQueryAgentAbilityProposalSwr,
    useQueryProviderRightsSwr,
} from "@/hooks/swr"
import type { AbilityMode, AttachmentWire, HeldAbilityWire, ProviderRightsWire, ProviderWire } from "@/modules/providerRights"

/** One provider an agent holds with what it has ticked. */
export interface HeldProvider {
    readonly provider: ProviderWire
    readonly held: ReadonlyArray<HeldAbilityWire>
}

/** The providers one agent holds, the ones it could still hold, and the commands that change them. */
interface AgentProviderRights {
    readonly isLoading: boolean
    readonly attached: ReadonlyArray<HeldProvider>
    /** Connected providers with at least one ability that the agent does not hold yet. */
    readonly attachable: ReadonlyArray<ProviderWire>
    readonly attach: (provider: string) => Promise<void>
    readonly detach: (provider: string) => Promise<void>
    readonly setAbility: (provider: string, ability: string, mode: AbilityMode) => Promise<void>
}

/** The attachments with one ability of one provider set to a mode (`off` drops it). */
const withAbility = (
    data: ProviderRightsWire,
    provider: string,
    ability: string,
    mode: AbilityMode,
): ProviderRightsWire => ({
    ...data,
    attachments: data.attachments.map((one): AttachmentWire => {
        if (one.provider !== provider) return one
        const others = one.abilities.filter((entry) => entry.id !== ability)
        return { ...one, abilities: mode === "off" ? others : [...others, { id: ability, mode }] }
    }),
})

/**
 * `providerRights` for one agent with `attachAgentProvider`, `detachAgentProvider` and `setAgentAbility`, each an SWR hook of the app.
 * Attaching ticks what the template proposes for the provider (`agentAbilityProposal`). A tick shows at once (optimistic) and the read
 * revalidates after the mutation.
 */
export const useProviderRights = (agentId: string, moduleKey: string): AgentProviderRights => {
    const read = useQueryProviderRightsSwr()
    const proposal = useQueryAgentAbilityProposalSwr(moduleKey)
    const attachMutation = useMutateAttachAgentProviderSwr()
    const detachMutation = useMutateDetachAgentProviderSwr()
    const setMutation = useMutateSetAgentAbilitySwr()
    const data = read.data
    const providers = data === undefined ? [] : data.providers
    const attachments = data === undefined ? [] : data.attachments.filter((one) => one.agentId === agentId)
    const attached = attachments.flatMap((attachment) => {
        const provider = providers.find((one) => one.provider === attachment.provider)
        return provider === undefined ? [] : [{ provider, held: attachment.abilities }]
    })
    const taken = new Set(attached.map((one) => one.provider.provider))
    return {
        isLoading: read.isLoading,
        attached,
        attachable: providers.filter((one) => one.connected && one.abilities.length > 0 && !taken.has(one.provider)),
        attach: async (provider) => {
            const proposed = proposal.data?.find((row) => row.provider === provider)
            await attachMutation.trigger({ agentId, provider, abilities: proposed?.abilities ?? [] })
            await read.mutate()
        },
        detach: async (provider) => {
            await detachMutation.trigger({ agentId, provider })
            await read.mutate()
        },
        setAbility: async (provider, ability, mode) => {
            if (data === undefined) return
            await read.mutate(
                async () => {
                    await setMutation.trigger({ agentId, provider, ability, mode })
                    return withAbility(data, provider, ability, mode)
                },
                { optimisticData: withAbility(data, provider, ability, mode), rollbackOnError: true, revalidate: true },
            )
        },
    }
}
