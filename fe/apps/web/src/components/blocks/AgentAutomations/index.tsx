"use client"

import { useTranslations } from "next-intl"
import { useAgentRights } from "@/hooks/agentSettings"
import { APP_ROUTES } from "@/modules/routes"
import { AgentAutomationsBase } from "./component"

/** The connected automations card of an agent: the way to all of them, for owners and managers. */
export const AgentAutomations = () => {
    const t = useTranslations("automations")
    const { canEdit } = useAgentRights()
    if (!canEdit) return null
    return (
        <AgentAutomationsBase
            props={{
                title: t("moduleTitle"),
                seeAllLabel: t("seeAll"),
                seeAllHref: APP_ROUTES.automations,
                help: t("moduleHelp"),
            }}
        />
    )
}
