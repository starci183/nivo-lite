"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useSave } from "@/hooks/modules"
import { chooseOperatingMode } from "@/lib/module-actions"
import { AgentModeCardBase } from "./component"

type Mode = "assist" | "autopilot"

/** The installation the card sets, as the settings page prepared it. */
type AgentModeCardProps = {
    readonly installationId: string
    readonly mode: Mode
    /** The short type name for the shared authority note; empty for a single instance agent. */
    readonly sharedType: string
    readonly canEdit: boolean
    readonly isLoading: boolean
}

/** The connected operating mode card: a choice saves at once and goes back when it is refused. */
export const AgentModeCard = (props: AgentModeCardProps) => {
    const t = useTranslations("modulesCore")
    const [mode, setMode] = useState<Mode>(props.mode)
    const { note, isPending, save } = useSave()
    return (
        <AgentModeCardBase
            props={{
                title: t("modeTitle"),
                options: [
                    { value: "assist", label: t("modeAssist") },
                    { value: "autopilot", label: t("modeAutopilot") },
                ],
                mode,
                help: mode === "autopilot" ? t("modeAutopilotHelp") : t("modeAssistHelp"),
                note: t("modeNote"),
                sharedNote: props.sharedType === "" ? "" : t("authorityShared", { type: props.sharedType }),
                isDisabled: !props.canEdit || isPending,
                isLoading: props.isLoading,
                failure: note.tone === "refused" ? note.text : "",
                failureTitle: t("notSaved"),
            }}
            on={{
                mode: (value) => {
                    const next: Mode = value === "autopilot" ? "autopilot" : "assist"
                    const previous = mode
                    setMode(next)
                    save(
                        () => chooseOperatingMode(props.installationId, next),
                        t("saved"),
                        () => setMode(previous),
                    )
                },
            }}
        />
    )
}
