"use client"

import { useState } from "react"
import { useQueryAgentAbilityProposalSwr, useQueryProviderRightsSwr } from "@/hooks/swr"
import type { CreateProviderRightsInput, HeldAccount, ProviderWire } from "@/modules/providerRights"

/** A provider the template names that the shop has not connected: its key and, when the board lists it, its labels. */
interface UnconnectedProvider {
    readonly key: string
    readonly provider: ProviderWire | undefined
}

/** One account card of the create dialog: the account and whether the new agent will be attached to it. */
interface ProposedCard extends HeldAccount {
    readonly isOn: boolean
}

/** The account cards of the create dialog: the template's proposal with the owner's edits, and what goes out with the create button. */
interface CreateAgentAttachments {
    readonly isLoading: boolean
    readonly cards: ReadonlyArray<ProposedCard>
    /** Providers the template names that the shop has not connected. */
    readonly unconnected: ReadonlyArray<UnconnectedProvider>
    readonly setAttached: (connectionId: string, isOn: boolean) => void
    /** The `providerRights` input of `createAgentInstallation`: every account left on (an account turned off is not attached). */
    readonly input: () => ReadonlyArray<CreateProviderRightsInput>
}

/**
 * `agentAbilityProposal({ moduleKey })` for the create dialog: one card per connected account of a provider the template names (for
 * payment only the shop's default receiving account), on by default and switchable off before the create button; a named provider
 * the shop has not connected is listed apart. The switches stay in state. An attachment holds nothing but the account.
 */
export const useAgentAttachmentProposal = (moduleKey: string | null): CreateAgentAttachments => {
    const proposal = useQueryAgentAbilityProposalSwr(moduleKey)
    const rights = useQueryProviderRightsSwr()
    const [off, setOff] = useState<ReadonlyArray<string>>([])
    const rows = proposal.data ?? []
    const shop = rights.data === undefined ? [] : rights.data.providers
    const cards = rows.flatMap((row): ReadonlyArray<ProposedCard> => {
        if (row.connectionId === null) return []
        const connectionId = row.connectionId
        const provider = shop.find((one) => one.provider === row.provider)
        const account = provider?.accounts.find((one) => one.connectionId === connectionId)
        if (provider === undefined || account === undefined) return []
        return [{ provider, account, isOn: !off.includes(connectionId) }]
    })
    const unconnected = rows
        .filter((row) => row.connectionId === null)
        .map((row) => ({ key: row.provider, provider: shop.find((one) => one.provider === row.provider) }))
    return {
        isLoading: proposal.isLoading || rights.isLoading,
        cards,
        unconnected,
        setAttached: (connectionId, isOn) =>
            setOff((current) => (isOn ? current.filter((one) => one !== connectionId) : [...current, connectionId])),
        input: () => cards.filter((card) => card.isOn).map((card) => ({ connectionId: card.account.connectionId })),
    }
}
