"use client"

import { useState } from "react"
import type { Settled } from "@/hooks/connection-wizard"
import type { SepayAccountForm, SepayConnectionView } from "@/modules/types"

/** The bank account form of the setup: the draft over what the connection holds, and its save, which clears the draft once it lands. */
export const useSepayAccountForm = (
    connection: SepayConnectionView | undefined,
    saveAccount: (view: SepayConnectionView, form: SepayAccountForm) => Promise<Settled<true>>,
) => {
    const [draft, setDraft] = useState<Partial<SepayAccountForm>>({})
    const [isPending, setPending] = useState(false)
    const form: SepayAccountForm = {
        bank: draft.bank ?? connection?.bankCode ?? "",
        account: draft.account ?? "",
        holder: draft.holder ?? connection?.holder ?? "",
    }
    return {
        form,
        isPending,
        on: {
            bank: (bank: string) => setDraft((current) => ({ ...current, bank })),
            account: (account: string) => setDraft((current) => ({ ...current, account })),
            holder: (holder: string) => setDraft((current) => ({ ...current, holder })),
            save: () => {
                if (connection === undefined) return
                setPending(true)
                void saveAccount(connection, form).then((settled) => {
                    setPending(false)
                    if (settled.kind === "ok") setDraft({})
                })
            },
        },
    }
}
