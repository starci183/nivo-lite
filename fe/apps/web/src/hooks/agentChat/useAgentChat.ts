"use client"

import { viewOf } from "./agentChat.shared"
import { useAgentChatNavigation } from "./useAgentChatNavigation"
import { useAgentChatThreadView } from "./useAgentChatThreadView"
import { useQueryAgentChatConversationsSwr, useQueryAgentChatMessagesSwr, useQueryAgentChatPageSwr } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { useFormatter, useTranslations } from "next-intl"
import { useMemo, useState } from "react"
import { useAgentChatActions } from "./useAgentChatActions"
import { readError } from "@/hooks/workspaceread"
import { slotOfReads } from "@/hooks/slot"
import type { SlotRead } from "@/hooks/slot"

/** Which channel the owner is looking at. */
export type ChatTab = "test" | "customer"

/** The agent the chat talks to, once it is loaded. */
export interface AgentChatAgent {
    readonly agentId: string
    readonly workspaceId: string
    readonly hasCustomerChannel: boolean
}

/** What the address names: the agent, whether the welcome was asked for, and the tab and conversation to open. */
export interface AgentChatRoute {
    readonly agentId: string | undefined
    readonly welcome: boolean
    readonly initialTab: ChatTab
    readonly initialConversationId: string | null
}

/** The conversation each channel has open. */
export type Selection = Record<ChatTab, string | null>

/** The chat tab a stored kind belongs to. */

/** The author of one message as the thread draws it. */

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

/** Conversation selection, SWR history and validated chat mutations. */
export const useAgentChat = (route: AgentChatRoute) => {
    const t = useTranslations("agentChat")
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
    const format = useFormatter()
    const router = navigation.useRouter()
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
    const history = useQueryAgentChatConversationsSwr(agent?.workspaceId, agent?.agentId)
    const selectedId = selected[tab]
    const messages = useQueryAgentChatMessagesSwr(agent?.workspaceId, selectedId)
    const selectedConversation = history.data?.find((item) => item.id === selectedId)
    const isTakenOver = tab === "customer" && selectedConversation?.handledBy != null

    const { opened, navigate } = useAgentChatNavigation(agent, router, setSelected, setTab)
    const actions = useAgentChatActions({ agent, tab, selectedId, isTakenOver, opened })

    const { rows, thread, changeTab, isLoadingList, isLoadingThread } = useAgentChatThreadView({
        hasCustomerChannel,
        setTab,
        actions,
        navigate,
        selected,
        format,
        history,
        t,
        selectedId,
        messages,
    })

    const queryError = readError(history) ?? readError(messages)
    return {
        ...viewOf({
            loaded,
            page,
            tab,
            rows,
            thread,
            actions,
            queryError,
            isLoadingList,
            isLoadingThread,
            isTakenOver,
            selectedId,
            selectedConversation,
            changeTab,
            opened,
        }),
        ...slotsOf({ page, loaded, history, messages, selectedId, rows }),
    }
}

interface ChatSlotInput {
    readonly page: ReturnType<typeof useQueryAgentChatPageSwr>
    readonly loaded: ReturnType<typeof useQueryAgentChatPageSwr>["data"]
    readonly history: ReturnType<typeof useQueryAgentChatConversationsSwr>
    readonly messages: ReturnType<typeof useQueryAgentChatMessagesSwr>
    readonly selectedId: string | null
    readonly rows: ReturnType<typeof useAgentChatThreadView>["rows"]
}

/** Folds each chat region's actual enabled reads and scopes recovery to those same queries. */
const slotsOf = (input: ChatSlotInput) => {
    const pageRead = { ...input.page, data: input.loaded }
    const reads: ReadonlyArray<SlotRead<unknown>> = input.loaded === undefined ? [pageRead] : [pageRead, input.history]
    const hasThreadRead = input.loaded !== undefined && input.selectedId !== null
    const retryRail = () => {
        void input.page.mutate()
        if (input.loaded !== undefined) void input.history.mutate()
    }
    return {
        railSlot: slotOfReads(reads, () => (input.loaded === undefined ? undefined : input.rows)),
        threadSlot: slotOfReads([...reads, ...(hasThreadRead ? [input.messages] : [])], () =>
            input.loaded === undefined ? undefined : { hasSelection: input.selectedId !== null },
        ),
        retryRail,
        retryThread: () => {
            retryRail()
            if (hasThreadRead) void input.messages.mutate()
        },
    }
}
