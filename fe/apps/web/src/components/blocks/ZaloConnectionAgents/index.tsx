"use client"

import { useTranslations } from "next-intl"
import { useSlotLabels } from "@/hooks/slot"
import { useConnectionRefusal } from "@/hooks/connections"
import { useZaloAgents, useZaloSetupStep } from "@/hooks/zaloConnection"
import { ZaloConnectionAgentsBase } from "./component"

/** What the page hands the card: the connection of the url. */
interface ZaloConnectionAgentsProps {
    readonly connectionId: string
}

/** The connected agents card of a Zalo OA connection: a switch saves the set of agents that work through it. */
export const ZaloConnectionAgents = (props: ZaloConnectionAgentsProps) => {
    const t = useTranslations("zaloConnection")
    const slotLabels = useSlotLabels()
    const { slot, toggle, reload, isOwner } = useZaloAgents(props.connectionId)
    const setup = useZaloSetupStep(props.connectionId, "agents")
    const refusal = useConnectionRefusal()
    if (refusal !== undefined) return null
    return (
        <ZaloConnectionAgentsBase
            props={{
                step: setup.step,
                title: t("agentsTitle"),
                agents: slot,
                slotLabels: slotLabels(t("agentsEmpty")),
                switchLabel: t("agentsSwitch"),
                onLabel: t("agentsOn"),
                canToggle: isOwner,
            }}
            on={{ toggleStep: setup.toggle, toggle: (agentId, isOn) => void toggle(agentId, isOn), retry: reload }}
        />
    )
}
