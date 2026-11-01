"use client"

import { CONSOLE_ROUTES, agentSetupHref, leadFlowHref } from "@/modules/routes"
import { useTranslations } from "next-intl"
import type { useAgentChat } from "./useAgentChat"

/** The prompts offered to the owner of a chat with a customer channel, and to one without. */
const CUSTOMER_PROMPTS = ["customerPrompt1", "customerPrompt2", "customerPrompt3"] as const
const TEAM_PROMPTS = ["teamPrompt1", "teamPrompt2", "teamPrompt3"] as const
const NEXT_STEPS = [
    { title: "next1Title", body: "next1Body" },
    { title: "next2Title", body: "next2Body" },
    { title: "next3Title", body: "next3Body" },
] as const

/** The chat as the hook resolved it. */
type AgentChatState = ReturnType<typeof useAgentChat>

/** Every word of the agent chat, resolved for the reader, grouped by the part of the surface that draws it. */
export const useAgentChatCopy = (chat: AgentChatState) => {
    const t = useTranslations("agentChat")
    const modules = useTranslations("modulesCore")
    const shell = useTranslations("shell")
    const agent = chat.agent
    const isLoading = agent === undefined
    const isCustomer = chat.tab === "customer"
    const name = agent?.name ?? ""
    const prompts = (agent?.hasCustomerChannel === true ? CUSTOMER_PROMPTS : TEAM_PROMPTS).map((key) => t(key))
    const subtitleOf = (): string => {
        if (isLoading) return ""
        if (isCustomer) return t(chat.isTakenOver ? "takenOverStatus" : "asVisitor")
        return `${t(agent.isActive ? "statusActive" : "statusPaused")} · ${agent.role}`
    }
    const placeholderOf = (): string => {
        if (isLoading) return t("messageLabel")
        if (chat.isTakenOver) return t("staffPlaceholder")
        return isCustomer ? t("widgetPlaceholder") : t("messagePlaceholder", { name })
    }
    const error = chat.error ?? chat.pageError
    return {
        crumbLabel: shell("crumbLabel"),
        crumbs: [
            { id: "home", label: shell("crumbHome"), href: CONSOLE_ROUTES.dashboard },
            { id: "modules", label: modules("catalogTitle"), href: "/agents" },
            isLoading ? { id: "agent", label: "", isSkeleton: true as const } : { id: "agent", label: name },
        ],
        header: headerOf(t, name, subtitleOf, isLoading, isCustomer, chat, agent),
        channelTabs:
            agent?.hasCustomerChannel === true
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
                    ? { label: t("handoffGate"), href: leadFlowHref(chat.leadId) }
                    : null,
            takenOverNotice: chat.isTakenOver ? t("takenOverNotice") : null,
        },
        messages: {
            messages: chat.thread,
            userAuthor: t(isCustomer ? "fromVisitor" : "fromYou"),
            agentName: name,
            typing: chat.isAwaitingReply ? t("typing", { name }) : null,
        },
        empty: emptyOf(name, t, isCustomer, chat, prompts),
        composer: {
            formLabel: t("composerLabel"),
            messageLabel: t("messageLabel"),
            placeholder: placeholderOf(),
            sendLabel: t("send"),
            draft: chat.draft,
            isSending: chat.isSending,
            isSkeleton: isLoading,
            canSend: chat.draft.trim().length > 0 && !chat.isSending && !isLoading,
            error: error ? { title: t(isLoading ? "loadingFailed" : "notSent"), text: error } : null,
            prompts: !isCustomer && chat.hasSelection ? prompts : [],
        },
    }
}

const emptyOf = (
    name: string,
    t: ReturnType<typeof useTranslations<"agentChat">>,
    isCustomer: boolean,
    chat: AgentChatState,
    prompts: string[],
) => {
    return {
        agentName: name,
        greeting: t("emptyGreeting", { name }),
        help: t(isCustomer ? "customerEmptyHelp" : "emptyGreetingHelp"),
        isCustomer,
        visitorLabel: t("visitorName"),
        visitorName: chat.visitorName,
        prompts,
        arePromptsDisabled: chat.isSending,
        startLabel: t(isCustomer ? "startVisitor" : "startTest"),
        isStarting: chat.isStarting,
        steps: isCustomer ? NEXT_STEPS.map((step) => `${t(step.title)}. ${t(step.body)}`) : [],
    }
}

const headerOf = (
    t: ReturnType<typeof useTranslations<"agentChat">>,
    name: string,
    subtitleOf: () => string,
    isLoading: boolean,
    isCustomer: boolean,
    chat: AgentChatState,
    agent:
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
        | undefined,
) => {
    return {
        backLabel: t("backModules"),
        name,
        subtitle: subtitleOf(),
        isSkeleton: isLoading,
        badge: isCustomer ? t("realAiBadge") : null,
        takeover:
            isCustomer && chat.hasSelection
                ? { label: t(chat.isTakenOver ? "giveBack" : "takeOver"), isPending: chat.isTakingOver }
                : null,
        openLeadLabel: chat.leadId === null ? null : t("openLead"),
        setup: agent === undefined ? null : { label: t("setupLink"), href: agentSetupHref(agent.id) },
    }
}
