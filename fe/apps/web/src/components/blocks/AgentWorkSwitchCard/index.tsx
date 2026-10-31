"use client"

import { useTranslations } from "next-intl"
import { useAgentWorkSwitch } from "@/hooks/agentWork"
import { useSlotLabels } from "@/hooks/slot"
import type { AgentWorkSwitchView } from "@/modules/types"
import { AgentWorkSwitchCardBase } from "./component"

/** The installation whose work the card switches. */
type AgentWorkSwitchCardProps = {
    readonly installationId: string
}

const PLACEHOLDER: AgentWorkSwitchView = { isOn: true, statusLabel: "-", tone: "neutral", canChange: false }

/** The connected work switch of one agent: owner only, taking effect at the agent's next turn. */
export const AgentWorkSwitchCard = (props: AgentWorkSwitchCardProps) => {
    const t = useTranslations("agentWork")
    const slotLabels = useSlotLabels()
    const { slot, change, isChanging, reload } = useAgentWorkSwitch(props.installationId)
    return (
        <AgentWorkSwitchCardBase
            props={{
                title: t("switchTitle"),
                switchLabel: t("switchLabel"),
                help: t("switchHelp"),
                ownerOnly: t("switchOwnerOnly"),
                isDisabled: isChanging,
                read: { slot, placeholder: PLACEHOLDER, labels: slotLabels(t("switchHelp")) },
            }}
            on={{ change: (on) => void change(on), retry: reload }}
        />
    )
}
