"use client"

import { useState, useTransition } from "react"
import { useAuthorizeGoogle } from "@/hooks/connections"
import { useMutateSetLedgerSheetSwr, useQueryGoogleStateSwr } from "@/hooks/swr"
import { ledgerStateOf } from "./googleLedger.shared"
import type { LedgerState } from "./googleLedger.shared"

/** What the ledger kept in a Google spreadsheet reads and does. */
interface GoogleLedger {
    readonly read: ReturnType<typeof useQueryGoogleStateSwr>
    readonly state: LedgerState
    readonly email: string
    /** The address of the ledger sheet, blank until named. */
    readonly sheetUrl: string
    /** The title of the ledger sheet as Google named it, blank until known. */
    readonly sheetTitle: string
    /** When the last row was written to it (ISO 8601), blank until the first row. */
    readonly lastRowAt: string
    /** The sheet link or id being typed, or the saved sheet while nothing was typed. */
    readonly sheet: string
    readonly setSheet: (value: string) => void
    /** The sheet was saved in this visit. */
    readonly saved: boolean
    readonly error: string | null
    readonly isPending: boolean
    /** Sends the owner to Google to give the access; the consent comes back to `returnTo`. */
    readonly allow: (purpose: "sheets" | undefined, returnTo: string) => void
    /** Saves the sheet being typed as the ledger. */
    readonly save: (failure: string) => void
}

/** The ledger of the workspace in a Google spreadsheet: where it stands, the sheet being typed, and the two commands that move it on. */
export const useGoogleLedger = (): GoogleLedger => {
    const authorize = useAuthorizeGoogle()
    const read = useQueryGoogleStateSwr()
    const setLedgerSheet = useMutateSetLedgerSheetSwr()
    const [error, setError] = useState<string | null>(null)
    const [typed, setTyped] = useState("")
    const [saved, setSaved] = useState(false)
    const [isPending, startTransition] = useTransition()
    const ledger = read.data?.ledger
    return {
        read,
        state: ledgerStateOf(ledger?.state ?? "none"),
        email: ledger?.email ?? "",
        sheetUrl: ledger?.sheetUrl ?? "",
        sheetTitle: ledger?.sheetTitle ?? "",
        lastRowAt: ledger?.lastRowAt ?? "",
        sheet: typed === "" ? (ledger?.sheetUrl ?? "") : typed,
        setSheet: setTyped,
        saved,
        error,
        isPending,
        allow: (purpose, returnTo) =>
            startTransition(async () => {
                setError(null)
                const answer = await authorize(returnTo, purpose)
                if (answer.kind !== "ok") return setError(answer.message)
                window.location.assign(answer.value)
            }),
        save: (failure) =>
            startTransition(async () => {
                setError(null)
                try {
                    await setLedgerSheet.trigger({ sheet: typed === "" ? (ledger?.sheetUrl ?? "") : typed })
                    setSaved(true)
                    await read.mutate()
                } catch (cause) {
                    setError(cause instanceof Error ? cause.message : failure)
                }
            }),
    }
}
