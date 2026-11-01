"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useChatbotActions } from "@/hooks/chatbot"
import { slotOfSwr } from "@/hooks/slot"
import { agentHref } from "@/modules/installations"
import type { ChatbotWaitingReply } from "@/modules/types"
import { WAITING_SHOWN, waitingRowOf } from "./chatbotWaiting.shared"
import { useChatbotWorkbench } from "@/hooks/chatbotWorkbench"

/** The customer replies of one Chatbot instance that wait for a person, each decided in place. */
export const useChatbotWaiting = (installationId: string | null) => {
    const t = useTranslations("workbenchChatbot")
    const workbench = useChatbotWorkbench(installationId, null)
    const actions = useChatbotActions(workbench.workspaceId ?? "", workbench.userId)
    const waiting = workbench.overview?.waiting
    const [editing, setEditing] = useState<{
        readonly workItemId: string
        readonly conversationId: string
        readonly text: string
    } | null>(null)
    const commands = {
        isBusy: actions.busy !== null,
        sendAnswer: actions.sendAnswer,
        toggleHandling: actions.toggleHandling,
        edit: (item: ChatbotWaitingReply) =>
            setEditing({ workItemId: item.workItemId, conversationId: item.conversationId, text: item.draft }),
    }
    const rows = waiting?.slice(0, WAITING_SHOWN).map((item) => waitingRowOf(t, item, commands))
    const hidden = (waiting?.length ?? 0) - WAITING_SHOWN
    return {
        slot: slotOfSwr({
            data: rows,
            error: workbench.isFailed ? t("loadError") : undefined,
            isLoading: waiting === undefined && !workbench.isFailed,
        }),
        count: waiting === undefined || waiting.length === 0 ? null : String(waiting.length),
        more:
            hidden > 0
                ? {
                      label: t("waitingMore", { n: hidden }),
                      href: agentHref("chatbot", installationId, "workbench", "tab=customers"),
                  }
                : null,
        /** The reply open for editing and what the person has typed; null while none is open. */
        editing,
        changeEdit: (text: string) => setEditing((current) => (current === null ? null : { ...current, text })),
        cancelEdit: () => setEditing(null),
        sendEdit: () => {
            if (editing === null) return
            void actions
                .sendAnswer(editing.conversationId, editing.workItemId, editing.text)
                .then(() => setEditing(null))
        },
        isBusy: commands.isBusy,
        reload: workbench.reload,
    }
}
