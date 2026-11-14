"use client"

import { useAgentRoute } from "@/hooks/installations"
import type { ReactNode } from "react"
import { useLocale, useTranslations } from "next-intl"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { useAgentNodeRights, useNodeRightsCopy } from "@/hooks/nodeRights"
import { useAgentInstallation } from "@/hooks/agentSettings"
import { useAgentTools } from "@/hooks/agentTools"
import { useProviderDialogs, useProviderRights } from "@/hooks/providerRights"
import { brainTabHref, workspaceHref } from "@/modules/routes"
import { AgentConnectionsBase } from "./component"
import type { AgentConnectionsBaseProps } from "./types"
import { toolsOf } from "./tools"
import { RIGHTS_PAGE_PLACEHOLDER, accountNameOf, detachOf, rightsPageOf } from "./view"

/** What the route hands the tab: the workspace and the installed agent of the url. */
interface AgentConnectionsProps {
    readonly workspaceId?: string | undefined
    readonly module?: string | undefined
    readonly installationId?: string | undefined
    /** The read-only roll-up of what the steps call (the block `AgentStepRights`), drawn under the accounts. */
    readonly rollup?: ReactNode
}

/**
 * The rights tab of an installed agent (route `/connections`, tab label "Permissions"): the connected ACCOUNTS it may use, each with
 * a small "Attach" or "Detach" (detach is the kill switch: no account, no tool), the roll-up of what its steps call (the mode of each
 * node, `auto | ask`, is edited in the step) and the NIVO tools it may call (`agentTools`), grouped by where each comes from. The tools
 * section is left out while the tools are not read (or not owner or manager).
 */
export const AgentConnections = (props: AgentConnectionsProps) => {
    const route = useAgentRoute(props)
    const t = useTranslations("agentRights")
    const tabs = useTranslations("modulesCore")
    const agent = useAgentInstallation(route.installationId, route.module).slot
    const view = "items" in agent ? agent.items : undefined
    const agentName = view?.name ?? ""
    const rights = useProviderRights(view?.agentId ?? "")
    const tools = useAgentTools(view?.agentId ?? null)
    const locale = useLocale()
    const dialogs = useProviderDialogs()
    const slotLabels = useSlotLabels()
    const copy = useNodeRightsCopy()
    const nodeRights = useAgentNodeRights(view?.agentId ?? null)
    const detaching = rights.attached.find((one) => one.account.connectionId === dialogs.detachKey)
    const read: AgentConnectionsBaseProps["props"]["read"] = {
        slot: mapSlot(nodeRights.slot, (answer) => rightsPageOf(answer, rights, locale, copy.common.notAttached)),
        placeholder: RIGHTS_PAGE_PLACEHOLDER,
        labels: slotLabels(copy.agent.accountsTitle),
    }
    const viewProps: AgentConnectionsBaseProps["props"] = {
        paneLabel: tabs("tab_connections"),
        read,
        accountsCard: {
            title: copy.agent.accountsTitle,
            note: copy.agent.accountsHint,
            attach: copy.common.attach,
            detach: copy.common.detach,
            empty: t("empty", { agent: agentName }),
        },
        isBoardLoading: rights.isLoading,
        rollup: props.rollup,
        detach: detachOf(t, detaching === undefined ? null : accountNameOf(detaching, locale), agentName),
        tools: toolsOf(t, tools.tools, {
            locale,
            agentName,
            linkHref: workspaceHref(route.workspaceId, brainTabHref("facts")),
            accounts: [...rights.attached, ...rights.attachable],
        }),
    }
    return (
        <AgentConnectionsBase
            props={viewProps}
            on={{
                attach: (connectionId) => void rights.attach(connectionId),
                askDetach: dialogs.setDetachKey,
                retry: nodeRights.retry,
                cancelDetach: () => dialogs.setDetachKey(null),
                confirmDetach: () => {
                    if (dialogs.detachKey !== null) void rights.detach(dialogs.detachKey)
                    dialogs.setDetachKey(null)
                },
            }}
        />
    )
}
