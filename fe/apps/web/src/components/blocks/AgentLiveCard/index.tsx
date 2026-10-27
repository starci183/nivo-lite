"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useAgentInstallation, useAgentRights, useChooseLive } from "@/hooks/agentSettings"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { AgentLiveCardBase } from "./component"
import type { LiveView } from "./component"

/** The installation the card switches. */
type AgentLiveCardProps = {
    readonly installationId: string
    readonly module: string
}

const PLACEHOLDER: LiveView = { isLive: false, statusLabel: "-", blocker: "" }

/** The connected live card: the switch shows at once and goes back when the server refuses it. */
export const AgentLiveCard = (props: AgentLiveCardProps) => {
    const t = useTranslations("modulesCore")
    const slotLabels = useSlotLabels()
    const { canEdit } = useAgentRights()
    const { slot, reload } = useAgentInstallation(props.installationId, props.module)
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
                help: t("liveHelp"),
                isDisabled: !canEdit || isSaving || (!hasVersion && !isLive),
                slot: mapSlot(slot, (installation): LiveView => ({
                    isLive,
                    statusLabel: isLive ? t("lifecycle_running") : t("lifecycle_ready"),
                    blocker: installation.hasVersion ? "" : t("liveNeedsVersion"),
                })),
                placeholder: PLACEHOLDER,
                slotLabels: slotLabels(t("liveHelp")),
            }}
            on={{ live: (next) => void change(next), retry: reload }}
        />
    )
}
