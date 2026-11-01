"use client"

import { useTranslations } from "next-intl"
import { connectionErrorOf } from "@/hooks/connection-wizard"
import { connectionCheckOf } from "@/hooks/connection-wire"
import { useMutateCheckTelegramConnectionSwr } from "@/hooks/swr"
import type { ConnectionNotice } from "@/modules/types"
import { WEBHOOK_REFUSED_CODE } from "./telegramConnection.shared"
import { useTelegramPage } from "./useTelegramPage"

/**
 * The notices under the header of a Telegram bot page, in reading order: why the bot cannot work, the refused command, a local site
 * Telegram cannot reach, and no agent yet. `command` is the failure of the last owner command, empty when there is none.
 */
export const useTelegramNotices = (
    connectionId: string | undefined,
    command: string,
): ReadonlyArray<ConnectionNotice> => {
    const t = useTranslations("telegramConnection")
    const tc = useTranslations("connections")
    const { slot } = useTelegramPage(connectionId)
    const { data } = useMutateCheckTelegramConnectionSwr(connectionId)
    const page = slot.items
    if (page === undefined) return []
    const isLive = page.status !== "disconnected"
    const stored = page.lastError
    return [
        ...(stored === null || !isLive
            ? []
            : [
                  {
                      id: "error",
                      tone: "negative" as const,
                      title: connectionErrorOf(stored, tc),
                      ...(stored === WEBHOOK_REFUSED_CODE ? { description: t("webhookRefusedHint") } : {}),
                  },
              ]),
        ...(command === "" ? [] : [{ id: "command", tone: "negative" as const, title: command }]),
        ...(data !== undefined && connectionCheckOf(data).localOnly
            ? [{ id: "local", tone: "informative" as const, title: t("localTitle"), description: t("localBody") }]
            : []),
        ...(isLive && page.agentIds.length === 0
            ? [{ id: "agents", tone: "cautionary" as const, title: t("noAgentTitle"), description: t("noAgentBody") }]
            : []),
    ]
}
