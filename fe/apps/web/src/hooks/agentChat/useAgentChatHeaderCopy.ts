"use client"

import { agentSetupHref } from "@/modules/routes"
import { useTranslations } from "next-intl"
import type { useAgentChat } from "./useAgentChat"

/** The chat as the hook resolved it. */
type AgentChatState = ReturnType<typeof useAgentChat>

/** The header of the agent chat: the agent, its state and the actions on the conversation. */
export interface AgentChatHeaderView {
    backLabel: string
    name: string
    subtitle: string
    isLoading: boolean
    badge: string | null
    takeover: {
        label: string
        isPending: boolean
    } | null
    openLeadLabel: string | null
    setup: {
        label: string
        href: string
    } | null
}

/** The words and the state of the header of the agent chat. */
export const useAgentChatHeaderCopy = (chat: AgentChatState): AgentChatHeaderView => {
    const t = useTranslations("agentChat")
    const agent = chat.agent
    const isLoading = agent === undefined
    const isCustomer = chat.tab === "customer"
    const subtitle = (): string => {
        if (isLoading) return ""
        if (isCustomer) return t(chat.isTakenOver ? "takenOverStatus" : "asVisitor")
        return `${t(agent.isActive ? "statusActive" : "statusPaused")} · ${agent.role}`
    }
    return {
        backLabel: t("backModules"),
        name: agent?.name ?? "",
        subtitle: subtitle(),
        isLoading,
        badge: isCustomer ? t("realAiBadge") : null,
        takeover:
            isCustomer && chat.hasSelection
                ? { label: t(chat.isTakenOver ? "giveBack" : "takeOver"), isPending: chat.isTakingOver }
                : null,
        openLeadLabel: chat.leadId === null ? null : t("openLead"),
        setup: agent === undefined ? null : { label: t("setupLink"), href: agentSetupHref(agent.id) },
    }
}
