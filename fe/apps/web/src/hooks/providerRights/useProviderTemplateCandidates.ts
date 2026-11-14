"use client"

import { useState } from "react"
import {
    useMutateAttachProviderByTemplateSwr,
    useQueryProviderRightsSwr,
    useQueryProviderTemplateCandidatesSwr,
} from "@/hooks/swr"
import type { AccountWire, ProviderWire, TemplateCandidateWire } from "@/modules/providerRights"

/** A connected account no agent of its template holds yet, with the agents that could get it by template. */
interface PendingAccount {
    readonly provider: ProviderWire
    readonly account: AccountWire
    readonly candidates: ReadonlyArray<TemplateCandidateWire>
}

/** The accounts waiting for "attach by template?", and the two answers (keyed by `connectionId`). */
interface ProviderTemplateCandidates {
    readonly isLoading: boolean
    readonly rows: ReadonlyArray<PendingAccount>
    readonly attach: (connectionId: string) => Promise<void>
    /** "Later": remembered here, not by the backend (the candidates keep answering until the account is attached). */
    readonly dismiss: (connectionId: string) => void
}

/**
 * `providerTemplateCandidates({ connectionId })` for each connected account of the shop whose provider serves tools, with
 * `attachProviderByTemplate`. An account with no candidate left is not listed.
 */
export const useProviderTemplateCandidates = (): ProviderTemplateCandidates => {
    const rights = useQueryProviderRightsSwr()
    const accounts =
        rights.data === undefined
            ? null
            : rights.data.providers
                  .filter((provider) => provider.tools.length > 0)
                  .flatMap((provider) =>
                      provider.accounts
                          .filter((account) => account.connected)
                          .map((account) => ({ provider, account })),
                  )
    const read = useQueryProviderTemplateCandidatesSwr(
        accounts === null ? null : accounts.map((one) => one.account.connectionId),
    )
    const attachMutation = useMutateAttachProviderByTemplateSwr()
    const [dismissed, setDismissed] = useState<ReadonlyArray<string>>([])
    const rows = (read.data ?? []).flatMap((row): ReadonlyArray<PendingAccount> => {
        const entry = accounts?.find((one) => one.account.connectionId === row.connectionId)
        if (entry === undefined || row.candidates.length === 0 || dismissed.includes(row.connectionId)) return []
        return [{ ...entry, candidates: row.candidates }]
    })
    return {
        isLoading: read.isLoading,
        rows,
        attach: async (connectionId) => {
            const agentIds = rows
                .filter((row) => row.account.connectionId === connectionId)
                .flatMap((row) => row.candidates.map((one) => one.agentId))
            await attachMutation.trigger({ connectionId, agentIds })
            await Promise.all([read.mutate(), rights.mutate()])
        },
        dismiss: (connectionId) => setDismissed((current) => [...current, connectionId]),
    }
}
