"use client"

import { useTranslations } from "next-intl"
import { useSlotLabels } from "@/hooks/slot"
import { useTelegramAgents } from "@/hooks/telegramConnection"
import { TelegramConnectionAgentsBase } from "./component"

/** What the page hands the card: the connection of the url. */
interface TelegramConnectionAgentsProps {
    readonly connectionId: string
}

/** The connected agents of a Telegram bot: a switch saves the set of agents that work through it (the owner only). */
export const TelegramConnectionAgents = (props: TelegramConnectionAgentsProps) => {
    const t = useTranslations("telegramConnection")
    const slotLabels = useSlotLabels()
    const { slot, toggle, reload, isOwner } = useTelegramAgents(props.connectionId)
    return (
        <TelegramConnectionAgentsBase
            props={{
                title: t("agentsTitle"),
                agents: slot,
                slotLabels: slotLabels(t("agentsEmpty")),
                switchLabel: t("agentsSwitch"),
                onLabel: t("agentsOn"),
                canToggle: isOwner,
            }}
            on={{ toggle: (agentId, isOn) => void toggle(agentId, isOn), retry: reload }}
        />
    )
}
