"use client"

import { useTranslations } from "next-intl"
import { useConnectionRefusal } from "@/hooks/connections"
import { useCopyLabels } from "@/hooks/connection-wizard"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { useTelegramAgents, useTelegramChecks, useTelegramPage, useTelegramSteps } from "@/hooks/telegramConnection"
import { TelegramConnectionStepsBase } from "./component"

/** What the page hands the steps: the connection of the url. */
interface TelegramConnectionStepsProps {
    readonly connectionId: string
}

/** The connected setup steps: done or not from the page read, the first one not done opens; the bodies of the webhook, check and agents steps are read here. */
export const TelegramConnectionSteps = (props: TelegramConnectionStepsProps) => {
    const t = useTranslations("telegramConnection")
    const slotLabels = useSlotLabels()
    const copyLabels = useCopyLabels()
    const { steps, toggle } = useTelegramSteps(props.connectionId)
    const { slot, reload } = useTelegramPage(props.connectionId)
    const { lines } = useTelegramChecks(props.connectionId)
    const agents = useTelegramAgents(props.connectionId)
    const refusal = useConnectionRefusal()
    if (refusal !== undefined) return null
    return (
        <TelegramConnectionStepsBase
            props={{
                steps,
                stepsLabel: t("stepsLabel"),
                webhook: {
                    label: t("webhookLabel"),
                    description: t("webhookHelp"),
                    url: mapSlot(slot, (page) => page.webhookUrl),
                    slotLabels: slotLabels(t("webhookEmpty")),
                    copyLabel: copyLabels.copy,
                    copiedLabel: copyLabels.copied,
                    copyErrorLabel: t("copyFailed"),
                },
                checks: { title: t("checksTitle"), lines, slotLabels: slotLabels(t("checksEmpty")) },
                agents: {
                    title: t("agentsTitle"),
                    agents: agents.slot,
                    slotLabels: slotLabels(t("agentsEmpty")),
                    switchLabel: t("agentsSwitch"),
                    onLabel: t("agentsOn"),
                    canToggle: agents.isOwner,
                },
            }}
            on={{
                toggle,
                retryWebhook: reload,
                retryChecks: reload,
                retryAgents: agents.reload,
                toggleAgent: (agentId, isOn) => void agents.toggle(agentId, isOn),
            }}
        />
    )
}
