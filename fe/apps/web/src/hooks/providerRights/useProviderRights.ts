"use client"

import {
    useMutateAttachAgentProviderSwr,
    useMutateDetachAgentProviderSwr,
    useQueryProviderRightsSwr,
} from "@/hooks/swr"
import type { HeldAccount, ProviderRightsWire } from "@/modules/providerRights"

/** The accounts one agent holds, the connected ones it could still hold, and the commands that change them (all keyed by `connectionId`). */
interface AgentAccountRights {
    readonly isLoading: boolean
    readonly attached: ReadonlyArray<HeldAccount>
    /** Connected accounts whose provider serves at least one tool and that the agent does not hold yet. */
    readonly attachable: ReadonlyArray<HeldAccount>
    readonly attach: (connectionId: string) => Promise<void>
    readonly detach: (connectionId: string) => Promise<void>
}

/** Every account of the board joined to its provider. */
const accountsOf = (data: ProviderRightsWire | undefined): ReadonlyArray<HeldAccount> =>
    data === undefined
        ? []
        : data.providers.flatMap((provider) => provider.accounts.map((account) => ({ provider, account })))

/**
 * `providerRights` for one agent, one card per attached ACCOUNT, with `attachAgentProvider` and `detachAgentProvider` keyed by
 * `connectionId`. An attachment is the agent and the account: nothing is ticked, and detaching it is the kill switch. The read
 * revalidates after each mutation.
 */
export const useProviderRights = (agentId: string): AgentAccountRights => {
    const read = useQueryProviderRightsSwr()
    const attachMutation = useMutateAttachAgentProviderSwr()
    const detachMutation = useMutateDetachAgentProviderSwr()
    const data = read.data
    const accounts = accountsOf(data)
    const attachments = data === undefined ? [] : data.attachments.filter((one) => one.agentId === agentId)
    const taken = new Set(attachments.map((one) => one.connectionId))
    return {
        isLoading: read.isLoading,
        attached: accounts.filter((entry) => taken.has(entry.account.connectionId)),
        attachable: accounts.filter(
            (entry) =>
                entry.account.connected && entry.provider.tools.length > 0 && !taken.has(entry.account.connectionId),
        ),
        attach: async (connectionId) => {
            await attachMutation.trigger({ agentId, connectionId })
            await read.mutate()
        },
        detach: async (connectionId) => {
            await detachMutation.trigger({ agentId, connectionId })
            await read.mutate()
        },
    }
}
