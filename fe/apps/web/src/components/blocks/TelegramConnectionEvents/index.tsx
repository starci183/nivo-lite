"use client"

import { useTranslations } from "next-intl"
import { useConnectionRefusal } from "@/hooks/connections"
import { useSlotLabels } from "@/hooks/slot"
import { useTelegramEventLines, useTelegramPage } from "@/hooks/telegramConnection"
import { TelegramConnectionEventsBase } from "./component"

/** The connection of the url. */
interface TelegramConnectionEventsProps {
    readonly connectionId: string
}

/**
 * The connected live rail of a Telegram bot connection. The back end reports no message feed for a bot (the page query holds only the
 * time of the last message), so the rail shows what it does report, read again every few seconds: the token, the webhook and the last
 * delivery error with their verdicts, the same lines as the check step.
 */
export const TelegramConnectionEvents = (props: TelegramConnectionEventsProps) => {
    const t = useTranslations("telegramConnection")
    const tc = useTranslations("connections")
    const slotLabels = useSlotLabels()
    const lines = useTelegramEventLines(props.connectionId)
    const { reload } = useTelegramPage(props.connectionId)
    const refusal = useConnectionRefusal()
    if (refusal !== undefined) return null
    return (
        <TelegramConnectionEventsBase
            props={{
                title: t("checksTitle"),
                liveLabel: tc("eventsLive"),
                emptyMessage: tc("eventsEmpty"),
                emptyHint: tc("eventsEmptyHint"),
                lines,
                slotLabels: slotLabels(tc("eventsEmpty")),
            }}
            on={{ retry: reload }}
        />
    )
}
