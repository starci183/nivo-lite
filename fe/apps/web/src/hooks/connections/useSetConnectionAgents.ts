"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useSettledGraphQL, type Settled } from "@/hooks/connection-wizard"
import { useMutateSetConnectionAgentsSwr } from "@/hooks/swr"
import { useConnectionsRefresh } from "./useConnectionsRefresh"

/** Makes exactly these agents the ones that work through a connection (the last step of every wizard) and toasts the outcome. */
export const useSetConnectionAgents = (): ((
    connectionId: string,
    wanted: ReadonlyArray<string>,
) => Promise<Settled<true>>) => {
    const t = useTranslations("connections")
    const settle = useSettledGraphQL()
    const refresh = useConnectionsRefresh()
    const { trigger } = useMutateSetConnectionAgentsSwr()
    return useCallback(
        async (connectionId: string, wanted: ReadonlyArray<string>): Promise<Settled<true>> => {
            const settled = await settle(
                () => trigger({ connectionId, agents: wanted.map((agentId) => ({ agentId })) }),
                t("toastAgentsSaved"),
            )
            if (settled.kind !== "ok") return settled
            await refresh()
            return { kind: "ok", value: true }
        },
        [settle, refresh, trigger, t],
    )
}
