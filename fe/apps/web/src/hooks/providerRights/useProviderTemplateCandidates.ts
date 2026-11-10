"use client"

import { useState } from "react"
import {
    useMutateAttachProviderByTemplateSwr,
    useQueryProviderRightsSwr,
    useQueryProviderTemplateCandidatesSwr,
} from "@/hooks/swr"
import type { TemplateCandidateWire } from "@/modules/providerRights"

/** A provider connected after the agents were made, with the agents that could get it by template. */
interface PendingProvider {
    readonly provider: string
    readonly candidates: ReadonlyArray<TemplateCandidateWire>
}

/** The providers waiting for "attach by template?", and the two answers. */
interface ProviderTemplateCandidates {
    readonly isLoading: boolean
    readonly rows: ReadonlyArray<PendingProvider>
    readonly attach: (provider: string) => Promise<void>
    /** "Later": remembered here, not by the backend (the candidates keep answering until the provider is attached). */
    readonly dismiss: (provider: string) => void
}

/**
 * `providerTemplateCandidates({ provider })` for each provider of the shop that has abilities, with `attachProviderByTemplate`. A provider
 * with no candidate left is not listed.
 */
export const useProviderTemplateCandidates = (): ProviderTemplateCandidates => {
    const rights = useQueryProviderRightsSwr()
    const keys = rights.data === undefined ? null : rights.data.providers.filter((one) => one.abilities.length > 0).map((one) => one.provider)
    const read = useQueryProviderTemplateCandidatesSwr(keys)
    const attachMutation = useMutateAttachProviderByTemplateSwr()
    const [dismissed, setDismissed] = useState<ReadonlyArray<string>>([])
    const all = read.data ?? []
    const rows = all.filter((row) => row.candidates.length > 0 && !dismissed.includes(row.provider))
    return {
        isLoading: read.isLoading,
        rows,
        attach: async (provider) => {
            const agentIds = rows.filter((row) => row.provider === provider).flatMap((row) => row.candidates.map((one) => one.agentId))
            await attachMutation.trigger({ provider, agentIds })
            await read.mutate()
        },
        dismiss: (provider) => setDismissed((current) => [...current, provider]),
    }
}
