"use client"

import { useTranslations } from "next-intl"
import { useSlotLabels } from "@/hooks/slot"
import { useTelegramChecks, useTelegramPage } from "@/hooks/telegramConnection"
import { TelegramConnectionChecksBase } from "./component"

/** What the page hands the check list: the connection of the url. */
interface TelegramConnectionChecksProps {
    readonly connectionId: string
}

/** The connected check list of a Telegram bot; the page header's "Check again" asks Telegram and the list reads the answer. */
export const TelegramConnectionChecks = (props: TelegramConnectionChecksProps) => {
    const t = useTranslations("telegramConnection")
    const slotLabels = useSlotLabels()
    const { lines } = useTelegramChecks(props.connectionId)
    const { reload } = useTelegramPage(props.connectionId)
    return (
        <TelegramConnectionChecksBase
            props={{ title: t("checksTitle"), lines, slotLabels: slotLabels(t("checksEmpty")) }}
            on={{ retry: reload }}
        />
    )
}
