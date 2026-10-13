"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useSave } from "@/hooks/modules"
import { chooseLive } from "@/lib/module-actions"
import { AgentLiveCardBase } from "./component"

/** The installation the card switches, as the settings page prepared it. */
type AgentLiveCardProps = {
    readonly installationId: string
    readonly isLive: boolean
    /** A context version was applied, so the agent may go live. */
    readonly hasVersion: boolean
    readonly canEdit: boolean
    readonly isLoading: boolean
}

/** The connected live card: the switch saves at once and goes back when it is refused. */
export const AgentLiveCard = (props: AgentLiveCardProps) => {
    const t = useTranslations("modulesCore")
    const [isLive, setLive] = useState(props.isLive)
    const { note, isPending, save } = useSave()
    return (
        <AgentLiveCardBase
            props={{
                title: t("liveTitle"),
                switchLabel: t("liveSwitch"),
                isLive,
                statusLabel: isLive ? t("status_live") : t("status_paused"),
                help: t("liveHelp"),
                blocker: !props.hasVersion && !props.isLoading ? t("liveNeedsVersion") : "",
                isDisabled: !props.canEdit || isPending || (!props.hasVersion && !isLive),
                isLoading: props.isLoading,
                failure: note.tone === "refused" ? note.text : "",
                failureTitle: t("notSaved"),
            }}
            on={{
                live: (next) => {
                    setLive(next)
                    save(
                        () => chooseLive(props.installationId, next),
                        t("saved"),
                        () => setLive(!next),
                    )
                },
            }}
        />
    )
}
