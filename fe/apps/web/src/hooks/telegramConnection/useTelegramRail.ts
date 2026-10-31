"use client"

import { useTranslations } from "next-intl"
import type { ConnectionRailLinesView } from "@/modules/types"
import { useTelegramEvents } from "./useTelegramEvents"

/** The live rail of a Telegram bot page; nothing is read while `connectionId` is undefined. */
export const useTelegramRail = (connectionId: string | undefined): ConnectionRailLinesView => {
    const t = useTranslations("telegramConnection")
    const { lines, reload } = useTelegramEvents(connectionId)
    return {
        title: t("eventsTitle"),
        liveLabel: t("eventsLive"),
        footnote: t("eventsFootnote"),
        emptyLabel: t("eventsEmpty"),
        lines,
        retry: reload,
    }
}
