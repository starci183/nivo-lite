"use client"

import { mapSlot } from "@/hooks/slot"
import type { DataSlot } from "@/modules/types"
import { useTelegramChecks } from "./useTelegramChecks"

/** One line of the live rail: a part of the bot, what NIVO saw of it, and its verdict when it is settled. */
type TelegramEventLine = {
    id: string
    title: string
    description: string
    verdict?: "success" | "danger"
}

/**
 * The lines of the live rail of a Telegram bot. The back end reports no message feed for a bot, so these are the check lines (token,
 * webhook, last delivery error); a line that only needs a look carries no verdict.
 */
export const useTelegramEventLines = (connectionId: string): DataSlot<ReadonlyArray<TelegramEventLine>> =>
    mapSlot(useTelegramChecks(connectionId).lines, (rows) =>
        rows.map((row) => ({
            id: row.id,
            title: row.title,
            description: row.description,
            ...(row.badge.tone === "warning"
                ? {}
                : { verdict: row.badge.tone === "success" ? ("success" as const) : ("danger" as const) }),
        })),
    )
