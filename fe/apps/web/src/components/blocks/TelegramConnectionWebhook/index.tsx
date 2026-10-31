"use client"

import { useTranslations } from "next-intl"
import { useCopyLabels } from "@/hooks/connection-wizard"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { useTelegramPage } from "@/hooks/telegramConnection"
import { TelegramConnectionWebhookBase } from "./component"

/** What the page hands the step body: the connection of the url. */
interface TelegramConnectionWebhookProps {
    readonly connectionId: string
}

/** The connected body of the webhook step: the address built from the app's public url configuration, read only. */
export const TelegramConnectionWebhook = (props: TelegramConnectionWebhookProps) => {
    const t = useTranslations("telegramConnection")
    const slotLabels = useSlotLabels()
    const copyLabels = useCopyLabels()
    const { slot, reload } = useTelegramPage(props.connectionId)
    return (
        <TelegramConnectionWebhookBase
            props={{
                label: t("webhookLabel"),
                description: t("webhookHelp"),
                url: mapSlot(slot, (page) => page.webhookUrl),
                slotLabels: slotLabels(t("webhookEmpty")),
                copyLabel: copyLabels.copy,
                copiedLabel: copyLabels.copied,
                copyErrorLabel: t("copyFailed"),
            }}
            on={{ retry: reload }}
        />
    )
}
