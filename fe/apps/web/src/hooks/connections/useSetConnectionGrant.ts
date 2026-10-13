"use client"

import { useTranslations } from "next-intl"
import { useCallback } from "react"
import { useSettledGraphQL } from "@/hooks/connection-wizard"
import type { Settled } from "@/hooks/connection-wizard"
import { useMutateSetConnectionGrantSwr } from "@/hooks/swr"
import type { Access } from "@/modules/types"
import { useConnectionsRefresh } from "./useConnectionsRefresh"

/** Gives one agent a level through a connection, or removes its access (`null`), and toasts the outcome. */
export const useSetConnectionGrant = () => {
    const t = useTranslations("connections")
    const settle = useSettledGraphQL()
    const refresh = useConnectionsRefresh()
    const { trigger } = useMutateSetConnectionGrantSwr()
    return useCallback(
        async (connectionId: string, agentId: string, access: Access | null): Promise<Settled<true>> => {
            const settled = await settle(() => trigger({ connectionId, agentId, access }), t("toastAccessSaved"))
            if (settled.kind !== "ok") return settled
            await refresh()
            return { kind: "ok", value: true }
        },
        [settle, refresh, trigger, t],
    )
}
