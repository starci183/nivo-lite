"use client"

import { useState } from "react"
import { useAgentRoute } from "@/hooks/installations"
import { useTranslations } from "next-intl"
import { useAgentInstallation, useAgentRemovalImpact, useAgentRights, useRemoveAgent } from "@/hooks/agentSettings"
import { AgentRemoveCardBase } from "./component"

/** The installation the card removes. */
type AgentRemoveCardProps = {
    readonly installationId?: string | undefined
    readonly module?: string | undefined
}

/** The connected danger section: removing asks first (stating what is erased), then leaves for the agents. */
export const AgentRemoveCard = (props: AgentRemoveCardProps) => {
    const route = useAgentRoute(props)
    const t = useTranslations("modulesCore")
    const tg = useTranslations("agentGeneral")
    const { canEdit } = useAgentRights()
    const { slot } = useAgentInstallation(route.installationId, route.module)
    const { remove, isRemoving } = useRemoveAgent(route.installationId)
    const [isOpen, setIsOpen] = useState(false)
    const impact = useAgentRemovalImpact(isOpen ? route.installationId : null)
    return (
        <AgentRemoveCardBase
            props={{
                rowTitle: tg("rowRemove"),
                hint: t("removeHint"),
                actionLabel: t("removeAction"),
                dialogTitle: t("removeDialogTitle", { name: ("items" in slot ? slot.items : undefined)?.name ?? "" }),
                impact: impact.lines,
                impactLabels: impact.labels,
                isOpen,
                cancelLabel: t("removeCancel"),
                confirmLabel: t("removeConfirm"),
                canRemove: canEdit && ("items" in slot ? slot.items : undefined) !== undefined,
                isRemoving,
            }}
            on={{ remove: () => void remove(), setOpen: setIsOpen, retryImpact: impact.retry }}
        />
    )
}
