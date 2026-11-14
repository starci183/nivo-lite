"use client"

import { useTranslations } from "next-intl"
import { useConnectionRefusal } from "@/hooks/connections"
import { useSlotLabels } from "@/hooks/slot"
import { useTelegramOverviewFacts, useTelegramPage } from "@/hooks/telegramConnection"
import { TelegramConnectionFactsBase } from "./component"

/** What the page hands the facts: the connection of the url. */
interface TelegramConnectionFactsProps {
    readonly connectionId: string
}

/**
 * The connected overview of a Telegram bot connection: the connection's facts. The setup's phases are the steps card of the same tab
 * (one stepper per page), so no second setup card is drawn here.
 */
export const TelegramConnectionFacts = (props: TelegramConnectionFactsProps) => {
    const t = useTranslations("telegramConnection")
    const tc = useTranslations("connections")
    const slotLabels = useSlotLabels()
    const facts = useTelegramOverviewFacts(props.connectionId)
    const { reload } = useTelegramPage(props.connectionId)
    const refusal = useConnectionRefusal()
    if (refusal !== undefined) return null
    return (
        <TelegramConnectionFactsBase
            props={{
                title: tc("factsTitle"),
                facts,
                slotLabels: slotLabels(t("factsEmpty")),
            }}
            on={{ retry: reload }}
        />
    )
}
