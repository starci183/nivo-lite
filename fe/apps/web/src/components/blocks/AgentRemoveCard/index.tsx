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
    const tg = useTranslations("agentGeneral")
    const { canEdit } = useAgentRights()
    const { slot } = useAgentInstallation(props.installationId, props.module)
    const { remove, isRemoving } = useRemoveAgent(props.installationId)
    return (
        <AgentRemoveCardBase
            props={{
                rowTitle: tg("rowRemove"),
                hint: t("removeHint"),
                actionLabel: t("removeAction"),
                dialogTitle: t("removeDialogTitle", { name: ("items" in slot ? slot.items : undefined)?.name ?? "" }),
                lines: [t("removeBody1"), t("removeBody2"), t("removeBody3")],
                cancelLabel: t("removeCancel"),
                confirmLabel: t("removeConfirm"),
                canRemove: canEdit && ("items" in slot ? slot.items : undefined) !== undefined,
                isRemoving,
            }}
            on={{ remove: () => void remove() }}
        />
    )
}
