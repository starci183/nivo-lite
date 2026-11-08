"use client"

import { useState } from "react"
import type { Settled } from "@/hooks/connection-wizard"
import type { SepayAccountForm, SepayConnectionView } from "@/modules/types"

type UseSepayAccountFormResult = {
    form: SepayAccountForm
    isPending: boolean
    on: {
        bank: (bank: string) => void
        account: (account: string) => void
        holder: (holder: string) => void
        save: () => void
    }
}

/** The bank account form of the setup: the draft over what the connection holds, and its save, which clears the draft once it lands. */
export const useSepayAccountForm = (
    connection: SepayConnectionView | undefined,
    saveAccount: (view: SepayConnectionView, form: SepayAccountForm) => Promise<Settled<true>>,
): UseSepayAccountFormResult => {
    const [draft, setDraft] = useState<Partial<SepayAccountForm>>({})
    const [isPending, setIsPending] = useState(false)
    const form: SepayAccountForm = {
        bank: draft.bank ?? connection?.bankCode ?? "",
        account: draft.account ?? "",
        holder: draft.holder ?? connection?.holder ?? "",
    }
    return {
        form,
        isPending,
        on: {
            bank: (bank: string): void => setDraft((current) => ({ ...current, bank })),
            account: (account: string): void => setDraft((current) => ({ ...current, account })),
            holder: (holder: string): void => setDraft((current) => ({ ...current, holder })),
            save: (): void => {
                if (connection === undefined) return
                setIsPending(true)
                void saveAccount(connection, form).then((settled) => {
                    setIsPending(false)
                    if (settled.kind === "ok") setDraft({})
                })
            },
        },
    }
}
