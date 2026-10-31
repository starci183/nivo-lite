"use client"

import { useConnectionAgentRows } from "@/hooks/connections"
import { useTelegramPage } from "./useTelegramPage"

/** The agents that can work through a Telegram bot, each marked when it does, with the owner's toggle. */
export const useTelegramAgents = (connectionId: string) =>
    useConnectionAgentRows(connectionId, "telegram", useTelegramPage(connectionId))
