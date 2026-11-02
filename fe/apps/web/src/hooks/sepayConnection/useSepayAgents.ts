"use client"

import { useMemo } from "react"
import { useSetConnectionAgents } from "@/hooks/connections"
import { loadingSlot, slotOfSwr } from "@/hooks/slot"
import { QUERY_SEPAY_CONNECTION_SWR_KEY, useQueryConnectionAgentsSwr } from "@/hooks/swr"
import { mutate } from "@/modules/viewer-cache"
import { matchesSwrKey } from "@/modules/utils"
import type { SepayAgentView, SlotRead } from "@/modules/types"

/** The accounting agents of the workspace and which of them work through this SePay connection. */
export const useSepayAgents = (connectionId: string, agentIds: ReadonlyArray<string>, isReady: boolean) => {
    const query = useQueryConnectionAgentsSwr()
    const save = useSetConnectionAgents()
    const rows = useMemo(
        () =>
            query.data
                ?.filter((agent) => agent.module === "accounting" && agent.status === "active")
                .map((agent): SepayAgentView => ({
                    id: agent.id,
                    name: agent.name,
                    isOn: agentIds.includes(agent.id),
                })),
        [query.data, agentIds],
    )
    const read: SlotRead<typeof rows> = {
        data: rows,
        error: query.error,
        isLoading: query.isLoading,
        isValidating: query.isValidating,
    }
    return {
        read,
        slot: isReady ? slotOfSwr(read) : loadingSlot<ReadonlyArray<SepayAgentView>>(),
        retry: () => {
            void query.mutate()
        },
        toggle: async (agentId: string, isOn: boolean) => {
            const wanted = isOn ? [...agentIds, agentId] : agentIds.filter((id) => id !== agentId)
            const settled = await save(connectionId, wanted)
            if (settled.kind === "ok") await mutate(matchesSwrKey(QUERY_SEPAY_CONNECTION_SWR_KEY))
        },
    }
}
