"use client"

import { useLocale, useTranslations } from "next-intl"
import { useAgentInstallation } from "@/hooks/agentSettings"
import { useAgentNivoTools } from "@/hooks/agentNivoTools"
import { useProviderDialogs, useProviderRights } from "@/hooks/providerRights"
import { AUTOMATION_ROUTES, brainTabHref, workspaceHref } from "@/modules/routes"
import { AgentConnectionsBase } from "./component"
import type { AgentConnectionsBaseProps } from "./types"
import { detachOf, drawerOf, groupsOf } from "./view"

/** What the route hands the tab: the workspace and the installed agent of the url. */
interface AgentConnectionsProps {
    readonly workspaceId: string
    readonly module: string
    readonly installationId: string
}

/**
 * The rights tab of an installed agent (route `/connections`, tab label "Permissions"): a card per provider it holds, with what it may do
 * through each (a write ability also automatic or ask), grouped by kind; "attach a provider" adds another; under them the NIVO tools it may
 * call. The provider rights come from the `providerRights` read and its mutations.
 */
export const AgentConnections = (props: AgentConnectionsProps) => {
    const t = useTranslations("agentRights")
    const tabs = useTranslations("modulesCore")
    const agent = useAgentInstallation(props.installationId, props.module).slot
    const view = "items" in agent ? agent.items : undefined
    const agentName = view?.name ?? ""
    const rights = useProviderRights(props.installationId, props.module)
    const tools = useAgentNivoTools(view?.agentId ?? null)
    const locale = useLocale()
    const dialogs = useProviderDialogs()
    const scope = {
        locale,
        connectionsHref: workspaceHref(props.workspaceId, AUTOMATION_ROUTES.connections),
        setAbility: (provider: string, ability: string, mode: Parameters<typeof rights.setAbility>[2]) =>
            void rights.setAbility(provider, ability, mode),
        askDetach: dialogs.setDetachKey,
    }
    const viewProps: AgentConnectionsBaseProps["props"] = {
        paneLabel: tabs("tab_connections"),
        title: t("title"),
        attachLabel: t("attachMore"),
        groups: groupsOf(t, rights.attached, scope),
        emptyLabel: t("empty", { agent: agentName }),
        tools: {
            title: t("toolsTitle"),
            linkLabel: t("toolsLink"),
            linkHref: workspaceHref(props.workspaceId, brainTabHref("facts")),
            rows: tools.rows.map((row) => ({ id: row.tool, title: row.name, subtitle: row.description, isOn: row.isOn })),
            isDisabled: tools.isSaving,
        },
        drawer: drawerOf(t, locale, rights.attachable, { isOpen: dialogs.isDrawerOpen, pickedId: dialogs.picked }),
        detach: detachOf(t, dialogs.detachKey, agentName),
    }
    return (
        <AgentConnectionsBase
            props={viewProps}
            on={{
                openDrawer: () => {
                    dialogs.setPicked(null)
                    dialogs.setIsDrawerOpen(true)
                },
                closeDrawer: () => dialogs.setIsDrawerOpen(false),
                pickAttach: dialogs.setPicked,
                submitAttach: () => {
                    if (dialogs.picked !== null) void rights.attach(dialogs.picked)
                    dialogs.setIsDrawerOpen(false)
                },
                cancelDetach: () => dialogs.setDetachKey(null),
                confirmDetach: () => {
                    if (dialogs.detachKey !== null) void rights.detach(dialogs.detachKey)
                    dialogs.setDetachKey(null)
                },
                toggleTool: tools.set,
            }}
        />
    )
}
