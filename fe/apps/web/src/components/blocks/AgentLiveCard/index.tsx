"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useAgentInstallation, useAgentRights, useChooseLive } from "@/hooks/agentSettings"
import { agentLifecycleTone, setupLabelKey } from "@/hooks/installations"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { AgentLiveCardBase } from "./component"
import type { LiveView } from "./component"

/** The installation the card switches. */
type AgentLiveCardProps = {
    readonly installationId: string
    readonly module: string
}

const PLACEHOLDER: LiveView = {
    isLive: false,
    statusLabel: "-",
    statusTone: "neutral",
    blocker: "",
    blockerAction: null,
}

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
                read: {
                    slot: mapSlot(slot, (installation): LiveView => ({
                        isLive,
                        statusLabel: t(`lifecycle_${installation.lifecycle}`),
                        statusTone: agentLifecycleTone(installation.lifecycle),
                        blocker: installation.isSetupPending ? t("liveNeedsVersion") : "",
                        blockerAction: installation.isSetupPending
                            ? { label: t(setupLabelKey(installation.lifecycle)), href: installation.setupHref }
                            : null,
                    })),
                    placeholder: PLACEHOLDER,
                    labels: slotLabels(t("liveHelp")),
                },
            }}
            on={{ live: (next) => void change(next), retry: reload }}
        />
    )
}
