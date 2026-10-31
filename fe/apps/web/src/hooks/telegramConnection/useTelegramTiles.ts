"use client"

import { useTranslations } from "next-intl"
import type { ConnectionTilesView } from "@/modules/types"
import { useTelegramFacts } from "./useTelegramFacts"
import { useTelegramPage } from "./useTelegramPage"

/** The health tiles of a Telegram bot page and the sentence for when there is nothing to show; nothing is read while `connectionId` is undefined. */
export const useTelegramTiles = (connectionId: string | undefined): ConnectionTilesView => {
    const t = useTranslations("telegramConnection")
    const { reload } = useTelegramPage(connectionId)
    return { facts: useTelegramFacts(connectionId), emptyLabel: t("factsEmpty"), retry: reload }
}
