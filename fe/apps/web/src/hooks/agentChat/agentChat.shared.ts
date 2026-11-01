import type { useAgentChatThreadView } from "./useAgentChatThreadView"
import type { useAgentChatNavigation } from "./useAgentChatNavigation"
import type { useTranslations } from "next-intl"
import type {
    useQueryAgentChatPageSwr,
    useQueryAgentChatConversationsSwr,
    useQueryAgentChatMessagesSwr,
} from "@/hooks/swr"
import type { useAgentChatActions } from "./useAgentChatActions"
import type { ChatTab } from "./useAgentChat"

/** Normalizes a stored conversation kind into its chat channel. */
export const tabOf = (kind: string): ChatTab => (kind === "customer" ? "customer" : "test")

/** Maps a stored author role to the role drawn by the chat thread. */
export const roleOf = (role: string): "user" | "system" | "agent" => {
    if (role === "user") return "user"
    return role === "system" ? "system" : "agent"
}

/** Formats a conversation history row and marks the selected conversation. */
export const conversationRowMapper = (
    t: ReturnType<typeof useTranslations<"agentChat">>,
    timeOf: (iso: string) => string,
    selectedId: string | null,
): ((item: NonNullable<ReturnType<typeof useQueryAgentChatConversationsSwr>["data"]>[number]) => {
    id: string
    kind: ChatTab
    title: string
    description: string
    isSelected: boolean
}) => {
    return (item) => {
        const kind = tabOf(item.kind)
        const customerLabel = item.channel === "telegram" ? `${t("kindCustomer")} · Telegram` : t("kindCustomer")
        const leadSuffix = item.leadId === null ? "" : ` · ${t("leadCaptured")}`
        return {
            id: item.id,
            kind,
            title: kind === "customer" ? (item.visitorName ?? t("websiteVisitor")) : t("testConversation"),
            description: `${kind === "customer" ? customerLabel : t("kindTest")} · ${timeOf(item.createdAt)}${leadSuffix}`,
            isSelected: item.id === selectedId,
        }
    }
}
/** The resolved inputs for agent chat view input. */
interface AgentChatViewInput {
    readonly loaded:
        | {
              id: string
              module: string
              name: string
              handle: string
              role: string
              avatarUrl: string | null
              isActive: boolean
              hasCustomerChannel: boolean
              workspaceId: string
              showWelcome: boolean
          }
        | undefined
    readonly page: ReturnType<typeof useQueryAgentChatPageSwr>
    readonly tab: ChatTab
    readonly rows: ReturnType<typeof useAgentChatThreadView>["rows"]
    readonly thread: ReturnType<typeof useAgentChatThreadView>["thread"]
    readonly actions: ReturnType<typeof useAgentChatActions>
    readonly queryError: unknown
    readonly history: ReturnType<typeof useQueryAgentChatConversationsSwr>
    readonly messages: ReturnType<typeof useQueryAgentChatMessagesSwr>
    readonly isTakenOver: boolean
    readonly selectedId: string | null
    readonly selectedConversation:
        | {
              id: string
              kind: string
              channel: string
              visitorName: string | null
              leadId: string | null
              handledBy: string | null
              createdAt: string
          }
        | undefined
    readonly changeTab: ReturnType<typeof useAgentChatThreadView>["changeTab"]
    readonly opened: ReturnType<typeof useAgentChatNavigation>["opened"]
}

/** Assembles the resolved domain state and commands for its drawing. */
export const viewOf = ({
    loaded,
    page,
    tab,
    rows,
    thread,
    actions,
    queryError,
    history,
    messages,
    isTakenOver,
    selectedId,
    selectedConversation,
    changeTab,
    opened,
}: AgentChatViewInput) => {
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
        file: actions.file,
        chooseFile: actions.chooseFile,
        clearFile: actions.clearFile,
        toggleTakeover: actions.toggleTakeover,
        changeTab,
        select: (conversationId: string, kind: ChatTab) => {
            opened(kind, conversationId)
            actions.message.clearErrors()
            actions.visitor.clearErrors()
        },
    }
}
