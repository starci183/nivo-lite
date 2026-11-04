"use client"

import { useCallback } from "react"
import { useSettledGraphQL } from "@/hooks/connection-wizard"
import type { Settled } from "@/hooks/connection-wizard"
import { useMutateAuthorizeGoogleSwr } from "@/hooks/swr"

/** What a Google consent is asked for: the Sheets connection (no purpose) or the spreadsheets access of the ledger. */
export type GoogleConsentPurpose = "sheets" | undefined

/** Starts the Google consent for the workspace: answers the address the browser is sent to (the back end signs the state). */
export const useAuthorizeGoogle = (): ((
    returnTo: string,
    purpose?: GoogleConsentPurpose,
) => Promise<Settled<string>>) => {
    const settle = useSettledGraphQL()
    const { trigger } = useMutateAuthorizeGoogleSwr()
    return useCallback(
        async (returnTo: string, purpose?: GoogleConsentPurpose): Promise<Settled<string>> => {
            const settled = await settle(() => trigger(purpose === undefined ? { returnTo } : { returnTo, purpose }))
            return settled.kind === "ok" ? { kind: "ok", value: settled.value.url } : settled
        },
        [settle, trigger],
    )
}
