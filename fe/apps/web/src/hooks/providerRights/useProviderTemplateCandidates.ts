"use client"

import { useState } from "react"
import { FRESH_PROVIDERS, fakeAttachProviderByTemplate, useFakeProviderTemplateCandidates } from "./fakeProviderTemplateCandidates"
import type { TemplateCandidateWire } from "./providerRights.types"

/** A provider connected after the agents were made, with the agents that could get it by template. */
export interface PendingProvider {
    readonly provider: string
    readonly candidates: ReadonlyArray<TemplateCandidateWire>
}

/** The providers waiting for "attach by template?", and the two answers. */
export interface ProviderTemplateCandidates {
    readonly rows: ReadonlyArray<PendingProvider>
    readonly attach: (provider: string) => Promise<void>
    /** "Để sau": remembered here, not by the backend (the candidates keep answering until the provider is attached). */
    readonly dismiss: (provider: string) => void
}

/**
 * `providerTemplateCandidates({ provider })` for each provider connected later, with `attachProviderByTemplate({ provider, agentIds })`.
 * FAKE SOURCE today (`fakeProviderTemplateCandidates.ts`).
 */
export const useProviderTemplateCandidates = (): ProviderTemplateCandidates => {
    const all = useFakeProviderTemplateCandidates()
    const [dismissed, setDismissed] = useState<ReadonlyArray<string>>([])
    return {
        rows: FRESH_PROVIDERS.filter((provider) => !dismissed.includes(provider)).flatMap((provider) => {
            const candidates = all[provider] ?? []
            return candidates.length === 0 ? [] : [{ provider, candidates }]
        }),
        attach: (provider) =>
            fakeAttachProviderByTemplate(
                provider,
                (all[provider] ?? []).map((row) => row.agentId),
            ),
        dismiss: (provider) => setDismissed((current) => [...current, provider]),
    }
}
