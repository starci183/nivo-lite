"use client"

import { useAgentChatSetupHref } from "./useAgentChatSetupHref"
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
    /** The names of the buttons that open the history drawer and the menu of more commands. */
    historyLabel: string
    moreLabel: string
    /** The test channel names setup in the head; the customer channel keeps it in the menu. */
    isTest: boolean
}

/** The words and the state of the header of the agent chat. */
export const useAgentChatHeaderCopy = (chat: AgentChatState): AgentChatHeaderView => {
    const t = useTranslations("agentChat")
    const agent = chat.agent
    const setupHref = useAgentChatSetupHref(agent)
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
        setup: setupHref === null ? null : { label: t("setupLink"), href: setupHref },
        historyLabel: t("historyToggle"),
        moreLabel: t("moreActions"),
        isTest: !isCustomer,
    }
}
