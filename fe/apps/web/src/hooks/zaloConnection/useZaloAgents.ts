"use client"

import { useCallback } from "react"
import { purposeFor } from "@/hooks/connection-access"
import { useConnectionsRole, useSetConnectionAgents } from "@/hooks/connections"
import { slotOfSwr } from "@/hooks/slot"
import { useQueryConnectionAgentsSwr } from "@/hooks/swr"
import type { DataSlot, ZaloAgentRowView } from "@/modules/types"
import { useZaloPage } from "./useZaloPage"

/** True for an agent of a module that can speak through a Zalo OA (a grant of that pair has a purpose). */
const canUseZalo = (module: string): boolean => purposeFor(module, "zalo_oa") !== null

/**
 * The agents that can work through a Zalo OA (Chatbot, Sales, Booking, Loyalty, Shifts), each marked when it does, and the toggle that
 * saves the set; only the owner may toggle, since the back end refuses everyone else.
 */
export const useZaloAgents = (connectionId: string) => {
    const page = useZaloPage(connectionId)
    const agentsRead = useQueryConnectionAgentsSwr()
    const setAgents = useSetConnectionAgents()
    const { role } = useConnectionsRole()
    const agents = slotOfSwr(agentsRead)
    const on = new Set(page.slot.items?.agentIds ?? [])
    const slot: DataSlot<ReadonlyArray<ZaloAgentRowView>> = {
        isLoading: agents.isLoading === true || page.slot.isLoading === true,
        isForbidden: agents.isForbidden,
        isError: agents.isError === true || page.slot.isError === true,
        items:
            agents.items === undefined || page.slot.items === undefined
                ? undefined
                : agents.items
                      .filter((agent) => on.has(agent.id) || (agent.status === "active" && canUseZalo(agent.module)))
                      .map((agent) => ({ id: agent.id, name: agent.name, isOn: on.has(agent.id) })),
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
    return { slot, toggle, reload: page.reload, isOwner: role === "owner" }
}
