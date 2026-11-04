"use client"

import { useTranslations } from "next-intl"
import type { useAgentChat } from "./useAgentChat"

/** The three steps offered after the first customer test. */
const NEXT_STEPS = [
    { title: "next1Title", body: "next1Body" },
    { title: "next2Title", body: "next2Body" },
    { title: "next3Title", body: "next3Body" },
] as const

/** The chat as the hook resolved it. */
type AgentChatState = ReturnType<typeof useAgentChat>

/** The empty state of the agent chat: the greeting, the prompts and the way to start. */
export interface AgentChatEmptyView {
    agentName: string
    greeting: string
    help: string
    isCustomer: boolean
    visitorLabel: string
    visitorName: string
    prompts: string[]
    arePromptsDisabled: boolean
    startLabel: string
    isStarting: boolean
    steps: string[]
}

/** The words of the empty state of the agent chat, the prompts being the ones the owner is offered. */
export const useAgentChatEmptyCopy = (chat: AgentChatState, prompts: string[]): AgentChatEmptyView => {
    const t = useTranslations("agentChat")
    const name = chat.agent?.name ?? ""
    const isCustomer = chat.tab === "customer"
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
