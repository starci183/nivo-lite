"use client"

import { useCallback } from "react"
import { useSetConnectionAgents } from "@/hooks/connections"
import { slotOfSwr } from "@/hooks/slot"
import { useQueryConnectionAgentsSwr } from "@/hooks/swr"
import type { DataSlot, ZaloAgentRowView } from "@/modules/types"
import { useZaloPage } from "./useZaloPage"

/** The agents of the workspace, each marked when it works through the Zalo connection, and the toggle that saves the set. */
export const useZaloAgents = (connectionId: string) => {
    const page = useZaloPage(connectionId)
    const agentsRead = useQueryConnectionAgentsSwr()
    const setAgents = useSetConnectionAgents()
    const agents = slotOfSwr(agentsRead)
    const on = new Set(page.slot.items?.agentIds ?? [])
    const slot: DataSlot<ReadonlyArray<ZaloAgentRowView>> = {
        isLoading: agents.isLoading === true || page.slot.isLoading === true,
        isForbidden: agents.isForbidden,
        isError: agents.isError === true || page.slot.isError === true,
        items:
            agents.items === undefined || page.slot.items === undefined
                ? undefined
                : agents.items.map((agent) => ({ id: agent.id, name: agent.name, isOn: on.has(agent.id) })),
    }
    const toggle = useCallback(
        async (agentId: string, isOn: boolean): Promise<void> => {
            const wanted = new Set(page.slot.items?.agentIds ?? [])
            if (isOn) wanted.add(agentId)
            else wanted.delete(agentId)
            await setAgents(connectionId, [...wanted])
            page.reload()
        },
        [page, setAgents, connectionId],
    )
    return { slot, toggle, reload: page.reload }
}
