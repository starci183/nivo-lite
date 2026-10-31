"use client"

import { useTranslations } from "next-intl"
import { useWorkspaceAgentWork } from "@/hooks/agentWork"
import { useSlotLabels } from "@/hooks/slot"
import type { WorkspaceAgentWorkView } from "@/modules/types"
import { AgentWorkWorkspaceSwitchBase } from "./component"

const PLACEHOLDER: WorkspaceAgentWorkView = { isOn: true, canChange: false, countsLabel: "-" }

/** The connected work switch of the whole workspace: owner only, taking effect at each agent's next turn. */
export const AgentWorkWorkspaceSwitch = () => {
    const t = useTranslations("agentWork")
    const slotLabels = useSlotLabels()
    const { slot, change, isChanging, reload } = useWorkspaceAgentWork()
    return (
        <AgentWorkWorkspaceSwitchBase
            props={{
                title: t("workspaceTitle"),
                switchLabel: t("workspaceLabel"),
                help: t("workspaceHelp"),
                offNotice: t("workspaceOffNotice"),
                ownerOnly: t("switchOwnerOnly"),
                isDisabled: isChanging,
                read: { slot, placeholder: PLACEHOLDER, labels: slotLabels(t("workspaceHelp")) },
            }}
            on={{ change: (on) => void change(on), retry: reload }}
        />
    )
}
