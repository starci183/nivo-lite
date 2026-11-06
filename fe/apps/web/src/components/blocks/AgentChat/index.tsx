"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useAgentChat, useAgentChatCopy, useAgentChatIsPhone } from "@/hooks/agentChat"
import { useSlotLabels } from "@/hooks/slot"
import { useWorkspaceId } from "@/hooks/workspaces"
import { navigation } from "@/modules/i18n"
import { AGENTS_ROUTE, agentChatHref, leadHref, workspaceHref } from "@/modules/routes"
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
    const workspaceId = useWorkspaceId()
    const slotLabels = useSlotLabels()
    const chat = useAgentChat(props)
    const isPhone = useAgentChatIsPhone()
    const copy = useAgentChatCopy(chat)
    const [isWelcomeOpen, setIsWelcomeOpen] = useState(true)
    const agent = chat.agent
    const agentId = agent?.id ?? ""
    const closeWelcome = () => {
        setIsWelcomeOpen(false)
        router.replace(workspaceHref(workspaceId, agentChatHref(agentId)), { scroll: false })
    }
    return (
        <AgentChatBase
            props={{
                crumbLabel: copy.crumbLabel,
                crumbs: copy.crumbs,
                pageLabel: t("pageLabel"),
                isStartDisabled: agent === undefined,
                avatarUrl: agent?.avatarUrl ?? null,
                seed: agentId,
                railTitle: t("railTitle"),
                railHeadTitle: isPhone ? "" : t("railTitle"),
                historyCloseLabel: t("historyClose"),
                newLabel: t(chat.tab === "customer" ? "newVisitor" : "newTest"),
                isStarting: chat.isStarting,
                railSlot: chat.railSlot,
                railLabels: slotLabels(t("railEmptyHelp")),
                isWaiting: "isLoading" in chat.railSlot,
                header: copy.header,
                channelTabs: copy.channelTabs,
                hasConversation: "items" in chat.threadSlot ? chat.threadSlot.items.hasSelection : true,
                threadSlot: chat.threadSlot,
                threadLabels: slotLabels(t("railEmptyHelp")),
                thread: copy.thread,
                welcome:
                    agent?.showWelcome === true && isWelcomeOpen
                        ? {
                              title: promo("welcomeTitle"),
                              text: promo("welcomeText"),
                              closeLabel: promo("welcomeClose"),
                          }
                        : null,
                messages: copy.messages,
                empty: copy.empty,
                composer: copy.composer,
            }}
            on={{
                retryRail: chat.retryRail,
                retryThread: chat.retryThread,
                toggleTakeover: () => void chat.toggleTakeover(),
                back: () => router.push(workspaceHref(workspaceId, AGENTS_ROUTE)),
                tab: chat.changeTab,
                draft: chat.setDraft,
                file: chat.chooseFile,
                fileClear: chat.clearFile,
                visitorName: chat.setVisitorName,
                send: (prompt) => void chat.send(prompt),
                start: () => void chat.start(),
                select: chat.select,
                openLead: () => router.push(workspaceHref(workspaceId, leadHref(chat.leadId ?? ""))),
                closeWelcome,
            }}
        />
    )
}
