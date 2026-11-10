"use client"

import { useLocale, useTranslations } from "next-intl"
import { useAgentInstallation } from "@/hooks/agentSettings"
import { useAgentTools } from "@/hooks/agentTools"
import { useProviderDialogs, useProviderRights } from "@/hooks/providerRights"
import { AUTOMATION_ROUTES, brainTabHref, workspaceHref } from "@/modules/routes"
import { AgentConnectionsBase } from "./component"
import type { AgentConnectionsBaseProps } from "./types"
import { toolsOf } from "./tools"
import { accountNameOf, detachOf, drawerOf, groupsOf } from "./view"

/** What the route hands the tab: the workspace and the installed agent of the url. */
interface AgentConnectionsProps {
    readonly workspaceId: string
    readonly module: string
    readonly installationId: string
}

/**
 * The rights tab of an installed agent (route `/connections`, tab label "Permissions"): a card per connected ACCOUNT it holds
 * ("SePay · MB ••••5252"), with what it may do through each (a write ability also automatic or ask), grouped by kind; "attach more
 * accounts" opens the drawer of the connected accounts it does not hold. The rights come from
 * the `providerRights` read and its mutations, keyed by `connectionId`. Under them the NIVO tools it may call (`agentTools`), grouped by
 * where each comes from; the owner's grant of its own "acts" tools is set there (`setMcpToolGrant`). The section is left out while the
 * tools are not read (no such query on the back end yet, or not owner or manager).
 */
export const AgentConnections = (props: AgentConnectionsProps) => {
    const t = useTranslations("agentRights")
    const tabs = useTranslations("modulesCore")
    const agent = useAgentInstallation(props.installationId, props.module).slot
    const view = "items" in agent ? agent.items : undefined
    const agentName = view?.name ?? ""
    const rights = useProviderRights(view?.agentId ?? "", props.module)
    const tools = useAgentTools(view?.agentId ?? null)
    const locale = useLocale()
    const dialogs = useProviderDialogs()
    const detaching = rights.attached.find((one) => one.account.connectionId === dialogs.detachKey)
    const scope = {
        locale,
        connectionsHref: workspaceHref(props.workspaceId, AUTOMATION_ROUTES.connections),
        setAbility: (connectionId: string, ability: string, mode: Parameters<typeof rights.setAbility>[2]) =>
            void rights.setAbility(connectionId, ability, mode),
        askDetach: dialogs.setDetachKey,
    }
    const viewProps: AgentConnectionsBaseProps["props"] = {
        paneLabel: tabs("tab_connections"),
        title: t("title"),
        attachLabel: t("attachMore"),
        groups: groupsOf(t, rights.attached, scope),
        emptyLabel: t("empty", { agent: agentName }),
        drawer: drawerOf(t, locale, rights.attachable, { isOpen: dialogs.isDrawerOpen, agentName }),
        detach: detachOf(t, detaching === undefined ? null : accountNameOf(detaching, locale), agentName),
        tools: toolsOf(t, tools.tools, {
            locale,
            agentName,
            linkHref: workspaceHref(props.workspaceId, brainTabHref("facts")),
            accounts: [...rights.attached, ...rights.attachable],
            isSaving: tools.isSaving,
            setGrant: tools.setGrant,
        }),
    }
    return (
        <AgentConnectionsBase
            props={viewProps}
            on={{
                openDrawer: () => dialogs.setIsDrawerOpen(true),
                closeDrawer: () => dialogs.setIsDrawerOpen(false),
                attach: (connectionId) => void rights.attach(connectionId),
                cancelDetach: () => dialogs.setDetachKey(null),
                confirmDetach: () => {
                    if (dialogs.detachKey !== null) void rights.detach(dialogs.detachKey)
                    dialogs.setDetachKey(null)
                },
            }}
        />
    )
}
