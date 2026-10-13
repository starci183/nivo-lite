import { useCallback, useMemo, useState } from "react"
import { useFormatter, useTranslations } from "next-intl"
import { useQueryAgentChatPageSwr, useQueryAgentChatConversationsSwr, useQueryAgentChatMessagesSwr } from "@/hooks/swr"
import { useActiveWorkspace } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { agentChatConversationHref } from "@/modules/routes"
import { useAgentChatActions } from "./useAgentChatActions"

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
type Selection = Record<ChatTab, string | null>

/** The chat tab a stored kind belongs to. */
const tabOf = (kind: string): ChatTab => (kind === "customer" ? "customer" : "test")

/** The author of one message as the thread draws it. */
const roleOf = (role: string): "user" | "system" | "agent" => {
    if (role === "user") return "user"
    return role === "system" ? "system" : "agent"
}

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

    const navigate = useCallback(
        (kind: ChatTab, id: string | null) => {
            if (agent === undefined) return
            router.replace(agentChatConversationHref(agent.agentId, kind, id), { scroll: false })
        },
        [router, agent],
    )
    const opened = useCallback(
        (kind: ChatTab, id: string) => {
            setSelected((current) => ({ ...current, [kind]: id }))
            setTab(kind)
            navigate(kind, id)
        },
        [navigate],
    )
    const actions = useAgentChatActions({ agent, tab, selectedId, isTakenOver, opened })

    const changeTab = (next: ChatTab) => {
        if (next === "customer" && !hasCustomerChannel) return
        setTab(next)
        actions.message.clearErrors()
        actions.visitor.clearErrors()
        navigate(next, selected[next])
    }

    const timeOf = useCallback(
        (iso: string) =>
            format.dateTime(new Date(iso), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
        [format],
    )

    const rows = useMemo(
        () =>
            (history.data ?? []).map((item) => {
                const kind = tabOf(item.kind)
                const customerLabel =
                    item.channel === "telegram" ? `${t("kindCustomer")} · Telegram` : t("kindCustomer")
                const leadSuffix = item.leadId === null ? "" : ` · ${t("leadCaptured")}`
                return {
                    id: item.id,
                    kind,
                    title: kind === "customer" ? (item.visitorName ?? t("websiteVisitor")) : t("testConversation"),
                    description: `${kind === "customer" ? customerLabel : t("kindTest")} · ${timeOf(item.createdAt)}${leadSuffix}`,
                    isSelected: item.id === selectedId,
                }
            }),
        [history.data, selectedId, t, timeOf],
    )

    const thread = useMemo(
        () =>
            (messages.data ?? []).map((item) => ({
                id: item.id,
                role: roleOf(item.role),
                body: item.body,
                timeLabel: timeOf(item.createdAt),
            })),
        [messages.data, timeOf],
    )

    const queryError = history.error ?? messages.error
    return {
        agent: loaded,
        pageError: page.error instanceof Error ? page.error.message : null,
        tab,
        rows,
        thread,
        draft: actions.message.watch("body"),
        visitorName: actions.visitor.watch("visitorName"),
        error: actions.error ?? (queryError instanceof Error ? queryError.message : null),
        isLoadingList: history.isLoading,
        isLoadingThread: messages.isLoading,
        isSending: actions.isSending,
        isAwaitingReply: actions.isAwaitingReply,
        isStarting: actions.isStarting,
        isTakingOver: actions.isTakingOver,
        isTakenOver,
        hasSelection: selectedId !== null,
        leadId: tab === "customer" ? (selectedConversation?.leadId ?? null) : null,
        setDraft: (body: string) =>
            actions.message.setValue("body", body, { shouldValidate: actions.message.formState.isSubmitted }),
        setVisitorName: (visitorName: string) =>
            actions.visitor.setValue("visitorName", visitorName, {
                shouldValidate: actions.visitor.formState.isSubmitted,
            }),
        start: actions.start,
        send: actions.send,
        toggleTakeover: actions.toggleTakeover,
        changeTab,
        select: (conversationId: string, kind: ChatTab) => {
            opened(kind, conversationId)
            actions.message.clearErrors()
            actions.visitor.clearErrors()
        },
    }
}
