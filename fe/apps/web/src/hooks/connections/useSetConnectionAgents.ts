"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useSettledGraphQL } from "@/hooks/connection-wizard"
import type { Settled } from "@/hooks/connection-wizard"
import { useMutateSetConnectionAgentsSwr } from "@/hooks/swr"
import type { Access } from "@/modules/types"
import { useConnectionsRefresh } from "./useConnectionsRefresh"

/** One agent wanted on a connection: a bare id keeps the agent's current level (or starts at "ask"), an object sets it. */
export type AgentWish = string | { readonly agentId: string; readonly access: Access }

const wishOf = (wish: AgentWish) => (typeof wish === "string" ? { agentId: wish } : wish)

/** Makes exactly these agents the ones that work through a connection (the last step of every wizard) and toasts the outcome. */
export const useSetConnectionAgents = () => {
    const t = useTranslations("connections")
    const settle = useSettledGraphQL()
    const refresh = useConnectionsRefresh()
    const { trigger } = useMutateSetConnectionAgentsSwr()
    return useCallback(
        async (connectionId: string, wanted: ReadonlyArray<AgentWish>): Promise<Settled<true>> => {
            const settled = await settle(
                () => trigger({ connectionId, agents: wanted.map(wishOf) }),
                t("toastAgentsSaved"),
            )
            if (settled.kind !== "ok") return settled
            await refresh()
            return { kind: "ok", value: true }
        },
        [settle, refresh, trigger, t],
    )
}
