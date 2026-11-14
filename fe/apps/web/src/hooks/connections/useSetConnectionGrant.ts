"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useSettledGraphQL, type Settled } from "@/hooks/connection-wizard"
import { useMutateSetConnectionGrantSwr } from "@/hooks/swr"
import { useConnectionsRefresh } from "./useConnectionsRefresh"

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
            const settled = await settle(() => trigger({ connectionId, agentId, bound }), t("toastAgentsSaved"))
            if (settled.kind !== "ok") return settled
            await refresh()
            return { kind: "ok", value: true }
        },
        [settle, refresh, trigger, t],
    )
}
