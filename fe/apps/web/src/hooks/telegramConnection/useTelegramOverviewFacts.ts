"use client"

import { useTranslations } from "next-intl"
import { mapSlot } from "@/hooks/slot"
import type { ConnectionFactView, DataSlot } from "@/modules/types"
import { useTelegramFacts } from "./useTelegramFacts"
import { useTelegramPage } from "./useTelegramPage"

/**
 * The term and value rows of the overview card of a Telegram bot connection: the bot, then the webhook (with the last message NIVO
 * received), the messages Telegram holds back (only once a check has asked) and how many agents work through the bot.
 */
export const useTelegramOverviewFacts = (
    connectionId: string | undefined,
): DataSlot<ReadonlyArray<ConnectionFactView>> => {
    const t = useTranslations("telegramConnection")
    const { slot } = useTelegramPage(connectionId)
    const tiles = useTelegramFacts(connectionId)
    return mapSlot(tiles, (rows) => [
        {
            id: "bot",
            label: t("factBot"),
            value: "items" in slot && slot.items.botUsername !== "" ? `@${slot.items.botUsername}` : "-",
        },
        ...rows.filter((row) => row.id !== "pending" || row.value !== "-"),
    ])
}
