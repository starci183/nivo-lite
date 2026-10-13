"use client"

import { useCallback } from "react"
import { useSettledGraphQL } from "@/hooks/connection-wizard"
import type { Settled } from "@/hooks/connection-wizard"
import { useMutateAuthorizeGoogleSwr } from "@/hooks/swr"

/** Starts the Google consent for the workspace: answers the address the browser is sent to (the back end signs the state). */
export const useAuthorizeGoogle = () => {
    const settle = useSettledGraphQL()
    const { trigger } = useMutateAuthorizeGoogleSwr()
    return useCallback(
        async (returnTo: string): Promise<Settled<string>> => {
            const settled = await settle(() => trigger({ returnTo }))
            return settled.kind === "ok" ? { kind: "ok", value: settled.value.url } : settled
        },
        [settle, trigger],
    )
}
