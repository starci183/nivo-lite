"use client"

import { useConnectionAgentRows } from "@/hooks/connections"
import { useZaloPage } from "./useZaloPage"

import type { DataSlot, ConnectionAgentRowView } from "@/modules/types"

type UseZaloAgentsResult = {
    slot: DataSlot<readonly ConnectionAgentRowView[]>
    toggle: (agentId: string, isOn: boolean) => Promise<void>
    reload: () => void
    isOwner: boolean
}

/** The agents that can work through a Zalo OA (Chatbot, Sales, Booking, Loyalty, Shifts), each marked when it does, with the owner's toggle. */
export const useZaloAgents = (connectionId: string): UseZaloAgentsResult =>
    useConnectionAgentRows(connectionId, "zalo_oa", useZaloPage(connectionId))
