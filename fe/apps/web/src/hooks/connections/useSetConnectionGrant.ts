"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useSettledGraphQL } from "@/hooks/connection-wizard"
import type { Settled } from "@/hooks/connection-wizard"
import { useMutateSetConnectionGrantSwr } from "@/hooks/swr"
import { useConnectionsRefresh } from "./useConnectionsRefresh"

/**
 * The wire still names a binding by a level: any level binds, null unbinds; the level itself is ignored (rights live in the agent's
 * attachments, the agent's rights tab). Removed with the field once the back end takes a plain bound flag.
 */
const BIND = "auto"

/** Binds one agent to a connection, or unbinds it, and toasts the outcome. */
export const useSetConnectionGrant = (): ((
    connectionId: string,
    agentId: string,
    bound: boolean,
) => Promise<Settled<true>>) => {
    const t = useTranslations("connections")
    const settle = useSettledGraphQL()
    const refresh = useConnectionsRefresh()
    const { trigger } = useMutateSetConnectionGrantSwr()
    return useCallback(
        async (connectionId: string, agentId: string, bound: boolean): Promise<Settled<true>> => {
            const settled = await settle(
                () => trigger({ connectionId, agentId, access: bound ? BIND : null }),
                t("toastAgentsSaved"),
            )
            if (settled.kind !== "ok") return settled
            await refresh()
            return { kind: "ok", value: true }
        },
        [settle, refresh, trigger, t],
    )
}
