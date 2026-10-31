"use client"

import { useConnectionAgentRows } from "@/hooks/connections"
import { useZaloPage } from "./useZaloPage"

/** The agents that can work through a Zalo OA (Chatbot, Sales, Booking, Loyalty, Shifts), each marked when it does, with the owner's toggle. */
export const useZaloAgents = (connectionId: string) =>
    useConnectionAgentRows(connectionId, "zalo_oa", useZaloPage(connectionId))
