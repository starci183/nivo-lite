"use client"

import { useTranslations } from "next-intl"
import { useAgentInstallation, useAgentRights, useRemoveAgent } from "@/hooks/agentSettings"
import { AgentRemoveCardBase } from "./component"

/** The installation the card removes. */
type AgentRemoveCardProps = {
    readonly installationId: string
    readonly module: string
}

/** The connected danger section: removing asks first, then leaves for the agents. */
export const AgentRemoveCard = (props: AgentRemoveCardProps) => {
    const t = useTranslations("modulesCore")
    const { canEdit } = useAgentRights()
    const { slot } = useAgentInstallation(props.installationId, props.module)
    const { remove, isRemoving } = useRemoveAgent(props.installationId)
    return (
        <AgentRemoveCardBase
            props={{
                title: t("removeTitle"),
                hint: t("removeHint"),
                actionLabel: t("removeAction"),
                dialogTitle: t("removeDialogTitle", { name: slot.items?.agentName ?? "" }),
                lines: [t("removeBody1"), t("removeBody2"), t("removeBody3")],
                cancelLabel: t("removeCancel"),
                confirmLabel: t("removeConfirm"),
                canRemove: canEdit && slot.items !== undefined,
                isRemoving,
            }}
            on={{ remove: () => void remove() }}
        />
    )
}
