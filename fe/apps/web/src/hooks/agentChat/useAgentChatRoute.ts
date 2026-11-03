"use client"

import { useQueryAgentChatPageSwr } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { useMemo, useState } from "react"
import type { Dispatch, SetStateAction } from "react"
import type { AgentChatAgent, AgentChatRoute, ChatTab, Selection } from "./useAgentChat"

/** The tab the page opens on: the customer channel needs an agent that has one. */
const routeTabOf = (hasCustomerChannel: boolean, route: AgentChatRoute): ChatTab =>
    hasCustomerChannel ? route.initialTab : "test"

/** The selection the route starts with. */
const routeSelectionOf = (hasCustomerChannel: boolean, route: AgentChatRoute): Selection => {
    const tab = routeTabOf(hasCustomerChannel, route)
    return {
        test: tab === "test" ? route.initialConversationId : null,
        customer: tab === "customer" ? route.initialConversationId : null,
    }
}

/** The agent the address names and the tab and conversation the owner has open, kept in step with the address. */
export interface AgentChatRouteState {
    readonly page: ReturnType<typeof useQueryAgentChatPageSwr>
    readonly loaded: ReturnType<typeof useQueryAgentChatPageSwr>["data"]
    readonly agent: AgentChatAgent | undefined
    readonly tab: ChatTab
    readonly selected: Selection
    readonly setTab: Dispatch<SetStateAction<ChatTab>>
    readonly setSelected: Dispatch<SetStateAction<Selection>>
}

/** Loads the agent of the address and holds the open tab and conversation, which start over when the address changes. */
export const useAgentChatRoute = (route: AgentChatRoute): AgentChatRouteState => {
    const { activeWorkspaceId } = useActiveWorkspace()
    const page = useQueryAgentChatPageSwr(activeWorkspaceId, route.agentId, route.welcome)
    const loaded =
        page.data?.workspaceId === activeWorkspaceId && page.data?.id === route.agentId ? page.data : undefined
    const agent = useMemo(
        (): AgentChatAgent | undefined =>
            loaded === undefined
                ? undefined
                : {
                      agentId: loaded.id,
                      workspaceId: loaded.workspaceId,
                      hasCustomerChannel: loaded.hasCustomerChannel,
                  },
        [loaded],
    )
    const hasCustomerChannel = agent?.hasCustomerChannel === true
    const routeKey = `${agent?.workspaceId}:${agent?.agentId}:${hasCustomerChannel}:${route.initialTab}:${route.initialConversationId}`
    const [seenRoute, setSeenRoute] = useState(routeKey)
    const [tab, setTab] = useState(routeTabOf(hasCustomerChannel, route))
    const [selected, setSelected] = useState(routeSelectionOf(hasCustomerChannel, route))
    if (seenRoute !== routeKey) {
        setSeenRoute(routeKey)
        setTab(routeTabOf(hasCustomerChannel, route))
        setSelected(routeSelectionOf(hasCustomerChannel, route))
    }
    return { page, loaded, agent, tab, selected, setTab, setSelected }
}
