"use client"

import { useConnectionAgentRows } from "@/hooks/connections"
import { useTelegramPage } from "./useTelegramPage"

import type { DataSlot, ConnectionAgentRowView } from "@/modules/types"

type UseTelegramAgentsResult = {
    slot: DataSlot<readonly ConnectionAgentRowView[]>
    toggle: (agentId: string, isOn: boolean) => Promise<void>
    reload: () => void
    isOwner: boolean
}

/** The agents that can work through a Telegram bot, each marked when it does, with the owner's toggle. */
export const useTelegramAgents = (connectionId: string): UseTelegramAgentsResult =>
    useConnectionAgentRows(connectionId, "telegram", useTelegramPage(connectionId))
