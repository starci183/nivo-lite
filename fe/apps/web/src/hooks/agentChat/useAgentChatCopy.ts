"use client"

import { useWorkspaceId } from "@/hooks/workspaces"
import { AGENTS_ROUTE, CONSOLE_ROUTES, leadFlowHref, workspaceHref } from "@/modules/routes"
import { useTranslations } from "next-intl"
import { CHAT_FILE_ACCEPT } from "@/hooks/chatFile"
import type { useAgentChat, ChatTab } from "./useAgentChat"
import type { ChatThreadMessage } from "@/modules/agent-chat"
import { useAgentChatEmptyCopy, type AgentChatEmptyView } from "./useAgentChatEmptyCopy"
import { useAgentChatHeaderCopy, type AgentChatHeaderView } from "./useAgentChatHeaderCopy"

/** The prompts offered to the owner of a chat with a customer channel, and to one without. */
const CUSTOMER_PROMPTS = ["customerPrompt1", "customerPrompt2", "customerPrompt3"] as const
const TEAM_PROMPTS = ["teamPrompt1", "teamPrompt2", "teamPrompt3"] as const

/** The chat as the hook resolved it. */
type AgentChatState = ReturnType<typeof useAgentChat>

/** The view `useAgentChatCopy` returns. */
export interface AgentChatCopyView {
    crumbLabel: string
    crumbs: (
        | {
              id: string
              label: string
              href: string
              isLoading?: never
          }
        | {
              id: string
              label: string
              isLoading: true
              href?: never
          }
        | {
              id: string
              label: string
              href?: never
              isLoading?: never
          }
    )[]
    header: AgentChatHeaderView
    channelTabs: {
        label: string
        selectedKey: ChatTab
        items: {
            id: string
            label: string
        }[]
    } | null
    thread: {
        label: string
        scrollKey: string
        handoff: {
            label: string
            href: string
        } | null
        takenOverNotice: string | null
    }
    messages: {
        messages: ChatThreadMessage[]
        userAuthor: string
        agentName: string
        typing: string | null
    }
    empty: AgentChatEmptyView
    composer: {
        formLabel: string
        messageLabel: string
        placeholder: string
        sendLabel: string
        draft: string
        isSending: boolean
        isLoading: boolean
        canSend: boolean
        file: {
            label: string
            removeLabel: string
            accept: string
            name: string | null
        }
        error: {
            title: string
            text: string
        } | null
        prompts: string[]
    }
}

/** Every word of the agent chat, resolved for the reader, grouped by the part of the surface that draws it. */
export const useAgentChatCopy = (chat: AgentChatState): AgentChatCopyView => {
    const t = useTranslations("agentChat")
    const modules = useTranslations("modulesCore")
    const shell = useTranslations("shell")
    const workspaceId = useWorkspaceId()
    const agent = chat.agent
    const isLoading = agent === undefined
    const isCustomer = chat.tab === "customer"
    const name = agent?.name ?? ""
    const prompts = (agent?.hasCustomerChannel === true ? CUSTOMER_PROMPTS : TEAM_PROMPTS).map((key) => t(key))
    const header = useAgentChatHeaderCopy(chat)
    const empty = useAgentChatEmptyCopy(chat, prompts)
    const placeholderOf = (): string => {
        if (isLoading) return t("messageLabel")
        if (chat.isTakenOver) return t("staffPlaceholder")
        return isCustomer ? t("widgetPlaceholder") : t("messagePlaceholder", { name })
    }
    const error = chat.error ?? chat.pageError
    return {
        crumbLabel: shell("crumbLabel"),
        crumbs: [
            { id: "home", label: shell("crumbHome"), href: workspaceHref(workspaceId, CONSOLE_ROUTES.dashboard) },
            { id: "modules", label: modules("catalogTitle"), href: workspaceHref(workspaceId, AGENTS_ROUTE) },
            isLoading ? { id: "agent", label: "", isLoading: true as const } : { id: "agent", label: name },
        ],
        header,
        channelTabs:
            isLoading || agent.hasCustomerChannel
                ? {
                      label: t("channelLabel"),
                      selectedKey: chat.tab,
                      items: [
                          { id: "test", label: t("tabTest") },
                          { id: "customer", label: t("tabCustomer") },
                      ],
                  }
                : null,
        thread: {
            label: t("messagesLabel"),
            scrollKey: `${chat.thread.length}:${chat.isSending}:${chat.hasSelection}`,
            handoff:
                isCustomer && chat.leadId !== null
                    ? { label: t("handoffGate"), href: workspaceHref(workspaceId, leadFlowHref(chat.leadId)) }
                    : null,
            takenOverNotice: chat.isTakenOver ? t("takenOverNotice") : null,
        },
        messages: {
            messages: chat.thread,
            userAuthor: isCustomer
                ? (chat.rows.find((row) => row.isSelected)?.title ?? t("fromVisitor"))
                : t("fromYou"),
            agentName: name,
            typing: chat.isAwaitingReply ? t("typing", { name }) : null,
        },
        empty,
        composer: {
            formLabel: t("composerLabel"),
            messageLabel: t("messageLabel"),
            placeholder: placeholderOf(),
            sendLabel: t("send"),
            draft: chat.draft,
            isSending: chat.isSending,
            isLoading: isLoading,
            canSend: !chat.isSending && !isLoading,
            file: {
                label: t("attachFile"),
                removeLabel: t("removeFile"),
                accept: CHAT_FILE_ACCEPT,
                name: chat.file?.name ?? null,
            },
            error: error ? { title: t(isLoading ? "loadingFailed" : "notSent"), text: error } : null,
            prompts: !isCustomer && chat.hasSelection ? prompts : [],
        },
    }
}
