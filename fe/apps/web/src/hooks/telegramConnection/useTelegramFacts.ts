"use client"

import { useFormatter, useTranslations } from "next-intl"
import { connectionCheckOf } from "@/hooks/connection-wire"
import { mapSlot } from "@/hooks/slot"
import { useMutateCheckTelegramConnectionSwr } from "@/hooks/swr"
import type { ConnectionFactView, DataSlot } from "@/modules/types"
import { WEBHOOK_REFUSED_CODE } from "./telegramConnection.shared"
import { useTelegramPage } from "./useTelegramPage"
import type { TelegramPageData } from "./useTelegramPage"

/** The health tiles of the page: the webhook, the messages Telegram holds back, and how many agents work through the bot. */
export const useTelegramFacts = (connectionId: string | undefined): DataSlot<ReadonlyArray<ConnectionFactView>> => {
    const t = useTranslations("telegramConnection")
    const format = useFormatter()
    const { slot } = useTelegramPage(connectionId)
    const { data } = useMutateCheckTelegramConnectionSwr(connectionId)
    const check = data === undefined ? undefined : connectionCheckOf(data)
    const lastMessageOf = (page: TelegramPageData): string => {
        if (page.lastEventAt === null) return t("tileWebhookNoEvent")
        const at = format.dateTime(new Date(page.lastEventAt), { dateStyle: "short", timeStyle: "short" })
        return t("tileWebhookLastEvent", { at })
    }
    const webhookOf = (page: TelegramPageData): string => {
        if (check?.localOnly === true) return t("tileWebhookUnregistered")
        if (page.healthy) return t("tileWebhookOk")
        return page.lastError === WEBHOOK_REFUSED_CODE ? t("tileWebhookRefused") : t("tileWebhookCheck")
    }
    return mapSlot(slot, (page) => [
        { id: "webhook", label: t("tileWebhook"), value: webhookOf(page), meta: lastMessageOf(page) },
        {
            id: "pending",
            label: t("tilePending"),
            value: check === undefined ? "-" : String(check.pending),
            meta: check === undefined ? t("tilePendingAsk") : t("tilePendingMeta"),
        },
        { id: "agents", label: t("tileAgents"), value: String(page.agentIds.length), meta: t("tileAgentsMeta") },
    ])
}
