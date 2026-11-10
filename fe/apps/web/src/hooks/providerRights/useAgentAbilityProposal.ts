"use client"

import { useState } from "react"
import { useQueryAgentAbilityProposalSwr, useQueryProviderRightsSwr } from "@/hooks/swr"
import type {
    AbilityMode,
    CreateProviderRightsInput,
    HeldAbilityWire,
    HeldAccount,
    ProviderWire,
} from "@/modules/providerRights"
import { modeOfAbility, onModeOf } from "./providerRights.shared"

/** A provider the template names that the shop has not connected: its key and, when the board lists it, its labels. */
interface UnconnectedProvider {
    readonly key: string
    readonly provider: ProviderWire | undefined
}

/** The account cards of the create dialog: the template's proposal with the owner's edits, and what goes out with the create button. */
interface CreateAgentAbilities {
    readonly isLoading: boolean
    readonly cards: ReadonlyArray<HeldAccount>
    /** Providers the template names that the shop has not connected. */
    readonly unconnected: ReadonlyArray<UnconnectedProvider>
    readonly setAbility: (connectionId: string, ability: string, mode: AbilityMode) => void
    /** The `providerRights` input of `createAgentInstallation`: every account with something ticked (an un-ticked account is not attached). */
    readonly input: () => ReadonlyArray<CreateProviderRightsInput>
}

const editKey = (connectionId: string, ability: string): string => `${connectionId}:${ability}`

/**
 * `agentAbilityProposal({ moduleKey })` for the create dialog: one card per connected account of a provider the template names, pre-ticked
 * as the template says (for payment only the shop's default receiving account), editable before the create button; a named provider the
 * shop has not connected is listed apart. The edits stay in state.
 */
export const useAgentAbilityProposal = (moduleKey: string | null): CreateAgentAbilities => {
    const proposal = useQueryAgentAbilityProposalSwr(moduleKey)
    const rights = useQueryProviderRightsSwr()
    const [edits, setEdits] = useState<Readonly<Record<string, AbilityMode>>>({})
    const rows = proposal.data ?? []
    const shop = rights.data === undefined ? [] : rights.data.providers
    const cards = rows.flatMap((row): ReadonlyArray<HeldAccount> => {
        if (row.connectionId === null) return []
        const connectionId = row.connectionId
        const provider = shop.find((one) => one.provider === row.provider)
        const account = provider?.accounts.find((one) => one.connectionId === connectionId)
        if (provider === undefined || account === undefined) return []
        const held = provider.abilities.flatMap((ability): ReadonlyArray<HeldAbilityWire> => {
            const mode = edits[editKey(connectionId, ability.id)] ?? modeOfAbility(row.abilities, ability.id)
            return mode === "off" ? [] : [{ id: ability.id, mode }]
        })
        return [{ provider, account, held }]
    })
    const unconnected = rows
        .filter((row) => row.connectionId === null)
        .map((row) => ({ key: row.provider, provider: shop.find((one) => one.provider === row.provider) }))
    return {
        isLoading: proposal.isLoading || rights.isLoading,
        cards,
        unconnected,
        setAbility: (connectionId, ability, mode) => {
            const card = cards.find((one) => one.account.connectionId === connectionId)
            const wire = card?.provider.abilities.find((one) => one.id === ability)
            if (wire === undefined) return
            const next = mode === "off" ? "off" : onModeOf(wire, mode)
            setEdits((current) => ({ ...current, [editKey(connectionId, ability)]: next }))
        },
        input: () =>
            cards
                .filter((card) => card.held.length > 0)
                .map((card) => ({ connectionId: card.account.connectionId, abilities: card.held })),
    }
}
