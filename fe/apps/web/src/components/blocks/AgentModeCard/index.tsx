"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useAgentInstallation, useAgentRights, useChooseOperatingMode } from "@/hooks/agentSettings"
import type { AgentMode } from "@/hooks/agentSettings"
import { useModuleName } from "@/hooks/installations"
import type { ModuleKey } from "@/hooks/installations"
import { AgentModeCardBase } from "./component"

/** The installation the card sets and its catalogue key. */
type AgentModeCardProps = {
    readonly installationId: string
    readonly module: ModuleKey
}

/** The connected operating mode card: a choice shows at once and goes back when the server refuses it. */
export const AgentModeCard = (props: AgentModeCardProps) => {
    const t = useTranslations("modulesCore")
    const typeName = useModuleName(props.module, "shortName")
    const { canEdit } = useAgentRights()
    const { slot } = useAgentInstallation(props.installationId, props.module)
    const [chosen, setChosen] = useState<AgentMode | null>(null)
    const { choose, isSaving } = useChooseOperatingMode(props.installationId)
    const mode = chosen ?? slot.items?.mode ?? "assist"
    const change = async (value: string) => {
        const next: AgentMode = value === "autopilot" ? "autopilot" : "assist"
        setChosen(next)
        await choose(next)
        setChosen(null)
    }
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
                sharedNote: slot.items?.isMulti === true ? t("authorityShared", { type: typeName }) : "",
                isDisabled: !canEdit || isSaving,
                isLoading: slot.items === undefined,
            }}
            on={{ mode: (value) => void change(value) }}
        />
    )
}
