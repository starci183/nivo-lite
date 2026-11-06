"use client"

import { useTranslations } from "next-intl"
import { useAgentRights } from "@/hooks/agentSettings"
import { APP_ROUTES, workspaceHref } from "@/modules/routes"
import { AgentAutomationsBase } from "./component"
import { useWorkspaceId } from "@/hooks/workspaces"

/** The connected automations card of an agent: the way to all of them, for owners and managers. */
export const AgentAutomations = () => {
    const workspaceId = useWorkspaceId()
    const t = useTranslations("automations")
    const { canEdit } = useAgentRights()
    if (!canEdit) return null
    return (
        <AgentAutomationsBase
            props={{
                title: t("moduleTitle"),
                seeAllLabel: t("seeAll"),
                seeAllHref: workspaceHref(workspaceId, APP_ROUTES.automations),
                help: t("moduleHelp"),
            }}
        />
    )
}
