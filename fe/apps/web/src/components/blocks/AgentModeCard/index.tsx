"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useAgentInstallation, useAgentRights, useChooseOperatingMode, type AgentMode } from "@/hooks/agentSettings"
import { useModuleName, type ModuleKey } from "@/hooks/installations"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { AgentModeCardBase, type ModeView } from "./component"

/** The installation the card sets and its catalogue key. */
type AgentModeCardProps = {
    readonly installationId: string
    readonly module: ModuleKey
}

const PLACEHOLDER: ModeView = { mode: "assist", help: "-", sharedNote: "" }

/** The connected operating mode card: a choice shows at once and goes back when the server refuses it. */
export const AgentModeCard = (props: AgentModeCardProps) => {
    const t = useTranslations("modulesCore")
    const typeName = useModuleName(props.module, "shortName")
    const slotLabels = useSlotLabels()
    const { canEdit } = useAgentRights()
    const { slot, reload } = useAgentInstallation(props.installationId, props.module)
    const [chosen, setChosen] = useState<AgentMode | null>(null)
    const { choose, isSaving } = useChooseOperatingMode(props.installationId)
    const mode = chosen ?? ("items" in slot ? slot.items : undefined)?.mode ?? "assist"
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
                note: t("modeNote"),
                isDisabled: !canEdit || isSaving,
                read: {
                    slot: mapSlot(slot, (installation): ModeView => ({
                        mode,
                        help: mode === "autopilot" ? t("modeAutopilotHelp") : t("modeAssistHelp"),
                        sharedNote: installation.isMulti ? t("authorityShared", { type: typeName }) : "",
                    })),
                    placeholder: PLACEHOLDER,
                    labels: slotLabels(t("modeTitle")),
                },
            }}
            on={{ mode: (value) => void change(value), retry: reload }}
        />
    )
}
