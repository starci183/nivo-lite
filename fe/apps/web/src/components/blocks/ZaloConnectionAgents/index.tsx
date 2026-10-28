"use client"

import { useTranslations } from "next-intl"
import { useSlotLabels } from "@/hooks/slot"
import { useZaloAgents } from "@/hooks/zaloConnection"
import { ZaloConnectionAgentsBase } from "./component"

/** What the page hands the card: the connection of the url. */
interface ZaloConnectionAgentsProps {
    readonly connectionId: string
}

/** The connected agents card of a Zalo OA connection: a switch saves the set of agents that work through it. */
export const ZaloConnectionAgents = (props: ZaloConnectionAgentsProps) => {
    const t = useTranslations("zaloConnection")
    const slotLabels = useSlotLabels()
    const { slot, toggle, reload } = useZaloAgents(props.connectionId)
    return (
        <ZaloConnectionAgentsBase
            props={{
                title: t("agentsTitle"),
                agents: slot,
                slotLabels: slotLabels(t("agentsEmpty")),
                switchLabel: t("agentsSwitch"),
            }}
            on={{ toggle: (agentId, isOn) => void toggle(agentId, isOn), retry: reload }}
        />
    )
}
