"use client"

import {
    useMutateAttachAgentProviderSwr,
    useMutateDetachAgentProviderSwr,
    useMutateSetAgentAbilitySwr,
    useQueryAgentAbilityProposalSwr,
    useQueryProviderRightsSwr,
} from "@/hooks/swr"
import type { AbilityMode, AttachmentWire, HeldAccount, ProviderRightsWire } from "@/modules/providerRights"

/** The accounts one agent holds, the connected ones it could still hold, and the commands that change them (all keyed by `connectionId`). */
interface AgentAccountRights {
    readonly isLoading: boolean
    readonly attached: ReadonlyArray<HeldAccount>
    /** Connected accounts whose provider has at least one ability and that the agent does not hold yet (nothing ticked). */
    readonly attachable: ReadonlyArray<HeldAccount>
    readonly attach: (connectionId: string) => Promise<void>
    readonly detach: (connectionId: string) => Promise<void>
    readonly setAbility: (connectionId: string, ability: string, mode: AbilityMode) => Promise<void>
}

/** The attachments with one ability of one account of one agent set to a mode (`off` drops it). */
const withAbility = (
    data: ProviderRightsWire,
    agentId: string,
    connectionId: string,
    ability: string,
    mode: AbilityMode,
): ProviderRightsWire => ({
    ...data,
    attachments: data.attachments.map((one): AttachmentWire => {
        if (one.agentId !== agentId || one.connectionId !== connectionId) return one
        const others = one.abilities.filter((entry) => entry.id !== ability)
        return { ...one, abilities: mode === "off" ? others : [...others, { id: ability, mode }] }
    }),
})

/** Every account of the board joined to its provider; the shop's default receiving account first within its provider. */
const accountsOf = (data: ProviderRightsWire | undefined): ReadonlyArray<Omit<HeldAccount, "held">> =>
    data === undefined
        ? []
        : data.providers.flatMap((provider) =>
              [...provider.accounts]
                  .sort((a, b) => Number(b.isDefaultReceiving) - Number(a.isDefaultReceiving))
                  .map((account) => ({ provider, account })),
          )

/**
 * `providerRights` for one agent, one card per attached ACCOUNT, with `attachAgentProvider`, `detachAgentProvider` and `setAgentAbility`
 * keyed by `connectionId`. Attaching ticks what the template proposes for that account (`agentAbilityProposal`; a non-default payment
 * account gets nothing ticked). A tick shows at once (optimistic) and the read revalidates after the mutation.
 */
export const useProviderRights = (agentId: string, moduleKey: string): AgentAccountRights => {
    const read = useQueryProviderRightsSwr()
    const proposal = useQueryAgentAbilityProposalSwr(moduleKey)
    const attachMutation = useMutateAttachAgentProviderSwr()
    const detachMutation = useMutateDetachAgentProviderSwr()
    const setMutation = useMutateSetAgentAbilitySwr()
    const data = read.data
    const accounts = accountsOf(data)
    const attachments = data === undefined ? [] : data.attachments.filter((one) => one.agentId === agentId)
    const attached = accounts.flatMap((entry) => {
        const attachment = attachments.find((one) => one.connectionId === entry.account.connectionId)
        return attachment === undefined ? [] : [{ ...entry, held: attachment.abilities }]
    })
    const taken = new Set(attachments.map((one) => one.connectionId))
    return {
        isLoading: read.isLoading,
        attached,
        attachable: accounts
            .filter(
                (entry) =>
                    entry.account.connected &&
                    entry.provider.abilities.length > 0 &&
                    !taken.has(entry.account.connectionId),
            )
            .map((entry) => ({ ...entry, held: [] })),
        attach: async (connectionId) => {
            const proposed = proposal.data?.find((row) => row.connectionId === connectionId)
            await attachMutation.trigger({ agentId, connectionId, abilities: proposed?.abilities ?? [] })
            await read.mutate()
        },
        detach: async (connectionId) => {
            await detachMutation.trigger({ agentId, connectionId })
            await read.mutate()
        },
        setAbility: async (connectionId, ability, mode) => {
            if (data === undefined) return
            const next = withAbility(data, agentId, connectionId, ability, mode)
            await read.mutate(
                async () => {
                    await setMutation.trigger({ agentId, connectionId, ability, mode })
                    return next
                },
                { optimisticData: next, rollbackOnError: true, revalidate: true },
            )
        },
    }
}
