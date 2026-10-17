"use client"

import { useCallback } from "react"
import { useMutateReturnZaloAuthorizationSwr } from "@/hooks/swr"
import { isRefusedByBackend } from "@/modules/failure"

/** What Zalo sends the browser back with after the owner granted the OA permissions. */
export interface ZaloReturnInput {
    readonly code: string | undefined
    readonly oaId: string | undefined
    readonly state: string | undefined
}

/** The Connections address the browser lands on, with the verdict the wizard shows on its check step. */
const connectionsHref = (verdict: string, connectionId?: string): string =>
    `/connections?zalo=${verdict}${connectionId === undefined ? "" : `&id=${connectionId}`}`

/**
 * Hands the Zalo return to the back end: the state names the connection and carries a one-time nonce; the back end proves the
 * signed-in member may connect it and queues the PKCE exchange, so the connection turns connected a moment later. Answers the
 * Connections address the browser should land on.
 */
export const useReturnZaloAuthorization = () => {
    const { trigger } = useMutateReturnZaloAuthorizationSwr()
    return useCallback(
        async (input: ZaloReturnInput): Promise<string> => {
            const state = input.state ?? ""
            if (input.code === undefined || state === "") return connectionsHref("denied")
            try {
                const connection = await trigger({
                    state,
                    code: input.code,
                    ...(input.oaId === undefined ? {} : { oaId: input.oaId }),
                })
                return connectionsHref("ok", connection.id)
            } catch (error) {
                return connectionsHref(isRefusedByBackend(error) ? "denied" : "failed", state.split(".")[0])
            }
        },
        [trigger],
    )
}
