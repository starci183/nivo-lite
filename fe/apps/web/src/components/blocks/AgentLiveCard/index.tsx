"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useAgentInstallation, useAgentRights, useChooseLive } from "@/hooks/agentSettings"
import { AgentLiveCardBase } from "./component"

/** The installation the card switches. */
type AgentLiveCardProps = {
    readonly installationId: string
    readonly module: string
}

/** The connected live card: the switch shows at once and goes back when the server refuses it. */
export const AgentLiveCard = (props: AgentLiveCardProps) => {
    const t = useTranslations("modulesCore")
    const { canEdit } = useAgentRights()
    const { slot } = useAgentInstallation(props.installationId, props.module)
    const [chosen, setChosen] = useState<boolean | null>(null)
    const { choose, isSaving } = useChooseLive(props.installationId)
    const isLive = chosen ?? slot.items?.isLive ?? false
    const hasVersion = slot.items?.hasVersion === true
    const change = async (next: boolean) => {
        setChosen(next)
        await choose(next)
        setChosen(null)
    }
    return (
        <AgentLiveCardBase
            props={{
                title: t("liveTitle"),
                switchLabel: t("liveSwitch"),
                isLive,
                statusLabel: isLive ? t("lifecycle_running") : t("lifecycle_ready"),
                help: t("liveHelp"),
                blocker: !hasVersion && slot.items !== undefined ? t("liveNeedsVersion") : "",
                isDisabled: !canEdit || isSaving || (!hasVersion && !isLive),
                isLoading: slot.items === undefined,
            }}
            on={{ live: (next) => void change(next) }}
        />
    )
}
