"use client"

import { useMemo, useState } from "react"
import { fakeAgentAbilityProposal, fakeTemplateUnconnectedProviders } from "./fakeAgentAbilityProposal"
import { SHOP_PROVIDERS } from "./fakeProviderRights"
import { modeOfAbility, onModeOf } from "./providerRights.shared"
import type { AbilityMode, CreateProviderRightsInput, HeldAbilityWire, ProviderWire } from "./providerRights.types"

/** One provider card of the create dialog: the provider and the mode of each of its abilities. */
export interface ProposedProvider {
    readonly provider: ProviderWire
    readonly held: ReadonlyArray<HeldAbilityWire>
}

/** The provider cards of the create dialog: the template's proposal with the owner's edits, and what goes with "Tạo agent". */
export interface CreateAgentAbilities {
    readonly cards: ReadonlyArray<ProposedProvider>
    /** Providers the template names that the shop has not connected. */
    readonly unconnected: ReadonlyArray<ProviderWire>
    readonly setAbility: (provider: string, ability: string, mode: AbilityMode) => void
    /** The `providerRights` input of `createAgent`. */
    readonly input: () => ReadonlyArray<CreateProviderRightsInput>
}

const editKey = (provider: string, ability: string): string => `${provider}:${ability}`

/**
 * `agentAbilityProposal({ moduleKey })` for the create dialog: every connected provider the template names, pre-ticked and editable before
 * "Tạo agent". FAKE SOURCE today (`fakeAgentAbilityProposal.ts`); the edits stay in state and go out as `providerRights` (the fake create logs them).
 */
export const useAgentAbilityProposal = (moduleKey: string | null): CreateAgentAbilities => {
    const proposal = useMemo(() => (moduleKey === null ? [] : fakeAgentAbilityProposal(moduleKey)), [moduleKey])
    const [edits, setEdits] = useState<Readonly<Record<string, AbilityMode>>>({})
    const cards = proposal.flatMap((row) => {
        const provider = SHOP_PROVIDERS.find((one) => one.provider === row.provider)
        if (provider === undefined) return []
        const held = provider.abilities.flatMap((ability): ReadonlyArray<HeldAbilityWire> => {
            const mode = edits[editKey(row.provider, ability.id)] ?? modeOfAbility(row.abilities, ability.id)
            return mode === "off" ? [] : [{ id: ability.id, mode }]
        })
        return [{ provider, held }]
    })
    const unconnected = (moduleKey === null ? [] : fakeTemplateUnconnectedProviders(moduleKey)).flatMap((key) => {
        const provider = SHOP_PROVIDERS.find((one) => one.provider === key)
        return provider === undefined ? [] : [provider]
    })
    return {
        cards,
        unconnected,
        setAbility: (provider, ability, mode) => {
            const wire = SHOP_PROVIDERS.find((one) => one.provider === provider)?.abilities.find((one) => one.id === ability)
            if (wire === undefined) return
            const next = mode === "off" ? "off" : onModeOf(wire, mode)
            setEdits((current) => ({ ...current, [editKey(provider, ability)]: next }))
        },
        input: () => cards.map((card) => ({ provider: card.provider.provider, abilities: card.held })),
    }
}
