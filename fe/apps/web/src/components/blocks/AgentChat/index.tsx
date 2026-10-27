"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useAgentChat, useAgentChatCopy } from "@/hooks/agentChat"
import { useSlotLabels } from "@/hooks/slot"
import { moduleGlyphOf } from "@/hooks/installations"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES, agentChatHref, leadHref } from "@/modules/routes"
import { AgentChatBase } from "./component"
import type { AgentChatTab } from "./component"

export type { AgentChatTab } from "./component"

/** Route identity for the connected chat block. */
interface AgentChatProps {
    /** Undefined renders the loading frame without starting a query. */
    readonly agentId: string | undefined
    readonly initialTab: AgentChatTab
    readonly initialConversationId: string | null
    readonly welcome: boolean
}

/** Connected agent chat: metadata and history come from the workspace-scoped GraphQL API. */
export const AgentChat = (props: AgentChatProps) => {
    const t = useTranslations("agentChat")
    const promo = useTranslations("promoAds")
    const router = navigation.useRouter()
    const slotLabels = useSlotLabels()
    const chat = useAgentChat(props)
    const copy = useAgentChatCopy(chat)
    const [isWelcomeOpen, setIsWelcomeOpen] = useState(true)
    const agent = chat.agent
    const moduleKey = agent?.module ?? "chatbot"
    const glyph = moduleGlyphOf(moduleKey)
    const agentId = agent?.id ?? ""
    const closeWelcome = () => {
        setIsWelcomeOpen(false)
        router.replace(agentChatHref(agentId), { scroll: false })
    }
    return (
        <AgentChatBase
            props={{
                crumbLabel: copy.crumbLabel,
                crumbs: copy.crumbs,
                pageLabel: t("pageLabel"),
                isStartDisabled: agent === undefined,
                glyph,
                module: moduleKey,
                railTitle: t("railTitle"),
                newLabel: t(chat.tab === "customer" ? "newVisitor" : "newTest"),
                isStarting: chat.isStarting,
                railSlot: { isLoading: agent === undefined || chat.isLoadingList, items: chat.rows },
                railLabels: slotLabels(t("railEmptyHelp")),
                header: copy.header,
                channelTabs: copy.channelTabs,
                threadSlot: {
                    isLoading: agent === undefined || chat.isLoadingThread,
                    items: { hasSelection: chat.hasSelection },
                },
                threadLabels: slotLabels(t("railEmptyHelp")),
                thread: copy.thread,
                welcome:
                    agent?.showWelcome === true && isWelcomeOpen
                        ? {
                              ariaLabel: promo("welcomeAria"),
                              title: promo("welcomeTitle"),
                              text: promo("welcomeText"),
                              closeLabel: promo("welcomeClose"),
                              testLabel: promo("welcomeTest"),
                              testHref: agentChatHref(agentId, "customer"),
                              officeLabel: promo("welcomeOffice"),
                              officeHref: CONSOLE_ROUTES.chat,
                          }
                        : null,
                messages: copy.messages,
                empty: copy.empty,
                composer: copy.composer,
            }}
            on={{
                toggleTakeover: () => void chat.toggleTakeover(),
                back: () => router.push(CONSOLE_ROUTES.modules),
                tab: chat.changeTab,
                draft: chat.setDraft,
                visitorName: chat.setVisitorName,
                send: (prompt) => void chat.send(prompt),
                start: () => void chat.start(),
                select: chat.select,
                openLead: () => router.push(leadHref(chat.leadId ?? "")),
                closeWelcome,
            }}
        />
    )
}
