"use client"

import { useState } from "react"
import { useQueryAgentAbilityProposalSwr, useQueryProviderRightsSwr } from "@/hooks/swr"
import type { AbilityMode, CreateProviderRightsInput, HeldAbilityWire, ProviderWire } from "@/modules/providerRights"
import { modeOfAbility, onModeOf } from "./providerRights.shared"

/** The provider cards of the create dialog: the template's proposal with the owner's edits, and what goes out with the create button. */
interface CreateAgentAbilities {
    readonly isLoading: boolean
    readonly cards: ReadonlyArray<{ readonly provider: ProviderWire; readonly held: ReadonlyArray<HeldAbilityWire> }>
    /** Providers the template names that the shop has not connected. */
    readonly unconnected: ReadonlyArray<ProviderWire>
    readonly setAbility: (provider: string, ability: string, mode: AbilityMode) => void
    /** The `providerRights` input of `createAgentInstallation`: the proposal with the owner edits. */
    readonly input: () => ReadonlyArray<CreateProviderRightsInput>
}

const editKey = (provider: string, ability: string): string => `${provider}:${ability}`

/**
 * `agentAbilityProposal({ moduleKey })` for the create dialog: every connected provider the template names, pre-ticked and editable before
 * the create button; the shop providers of the same kinds that are not connected are listed apart. The edits stay in state.
 */
export const useAgentAbilityProposal = (moduleKey: string | null): CreateAgentAbilities => {
    const proposal = useQueryAgentAbilityProposalSwr(moduleKey)
    const rights = useQueryProviderRightsSwr()
    const [edits, setEdits] = useState<Readonly<Record<string, AbilityMode>>>({})
    const rows = proposal.data ?? []
    const shop = rights.data === undefined ? [] : rights.data.providers
    const named = rows.flatMap((row) => {
        const provider = shop.find((one) => one.provider === row.provider)
        return provider === undefined ? [] : [{ provider, row }]
    })
    const cards = named.map(({ provider, row }) => ({
        provider,
        held: provider.abilities.flatMap((ability): ReadonlyArray<HeldAbilityWire> => {
            const mode = edits[editKey(row.provider, ability.id)] ?? modeOfAbility(row.abilities, ability.id)
            return mode === "off" ? [] : [{ id: ability.id, mode }]
        }),
    }))
    const kinds = new Set(named.map(({ provider }) => provider.kind))
    const unconnected = shop.filter((one) => !one.connected && one.abilities.length > 0 && kinds.has(one.kind))
    return {
        isLoading: proposal.isLoading || rights.isLoading,
        cards,
        unconnected,
        setAbility: (provider, ability, mode) => {
            const wire = shop.find((one) => one.provider === provider)?.abilities.find((one) => one.id === ability)
            if (wire === undefined) return
            const next = mode === "off" ? "off" : onModeOf(wire, mode)
            setEdits((current) => ({ ...current, [editKey(provider, ability)]: next }))
        },
        input: () => cards.map((card) => ({ provider: card.provider.provider, abilities: card.held })),
    }
}
