"use client"

import { useChatbotTextForm } from "@/hooks/rhf"
import type { ChatbotTextFormOptions } from "@/hooks/rhf"
import { useChatbotInboxView } from "./useChatbotInboxView"
import { useChatbotActions, useChatbotThread } from "@/hooks/chatbot"
import type { InboxFilter } from "@/hooks/chatbot"
import { navigation } from "@/modules/i18n"
import type { ChatbotConversation, ChatbotOverview } from "@/modules/types"
import { useTranslations } from "next-intl"
import { useState, useTransition } from "react"

/** Who looks at the inbox, and which conversation the route asks for. */
export interface ChatbotInboxInput {
    readonly overview: ChatbotOverview | undefined
    readonly selectedId: string | null
    readonly userName: string
    readonly userId: string
}

/** The list pane or the thread pane, as far as the member chose; `undefined` while the member did not choose. */
export interface InboxView {
    readonly pane: "list" | "thread" | undefined
    readonly isInfoOpen: boolean
    readonly pickedId: string | null
}

/** The filter and the text typed in the search box. */
export interface InboxFilters {
    readonly filter: InboxFilter
    readonly query: string
}

/** Keeps the draft of a conversation or an escalation by its id. */
type Drafts = Readonly<Record<string, string>>

/** The words, rows and actions of the inbox: validated drafts, queued replies, the open thread. Drafts stay tied to their conversation or escalation. */
export const useChatbotInbox = (input: ChatbotInboxInput) => {
    const { overview, userName, userId } = input
    const t = useTranslations("workbenchChatbot")

    const router = navigation.useRouter()
    const pathname = navigation.usePathname()

    const [view, setView] = useState<InboxView>({ pane: undefined, isInfoOpen: false, pickedId: null })
    const [replyDrafts, setReplyDrafts] = useState<Drafts>({})
    const [answerDrafts, setAnswerDrafts] = useState<Drafts>({})
    const [isNavigating, startNavigation] = useTransition()
    const selectedId = isNavigating && view.pickedId !== null ? view.pickedId : input.selectedId
    const threadQuery = useChatbotThread(overview?.workspaceId, selectedId ?? undefined)
    const actions = useChatbotActions(overview?.workspaceId ?? "", userId)
    const thread = threadQuery.data ?? null
    const conversation = thread?.conversation ?? null
    const escalation = thread?.escalation ?? null
    const name = conversation?.name || t("unknownCustomer")
    const replyDraft = selectedId === null ? "" : (replyDrafts[selectedId] ?? "")
    const answerDraft = escalation === null ? "" : (answerDrafts[escalation.workItemId] ?? escalation.draft)
    const feedback = actions.feedback?.conversationId === selectedId ? actions.feedback : null
    const replyForm = useChatbotTextForm(
        replyFormOf(replyDraft, selectedId, setReplyDrafts, conversation, userName, actions),
    )
    const answerForm = useChatbotTextForm({
        draft: answerDraft,
        tooLong: "answerTooLong",
        onDraft: (value) => {
            if (escalation !== null) setAnswerDrafts((current) => ({ ...current, [escalation.workItemId]: value }))
        },
        onSubmit: async (text) => {
            if (selectedId !== null && escalation !== null)
                await actions.sendAnswer(selectedId, escalation.workItemId, text)
        },
    })

    const actionError = (): string | null => {
        if (threadQuery.error instanceof Error) return threadQuery.error.message
        return feedback?.kind === "handling" ? feedback.message : null
    }
    return useChatbotInboxView(
        actionError,
        view,
        input,
        selectedId,
        overview,
        thread,
        threadQuery,
        name,
        userName,
        replyDraft,
        replyForm,
        feedback,
        actions,
        answerDraft,
        answerForm,
        setView,
        startNavigation,
        router,
        pathname,
        conversation,
        escalation,
    )
}

const replyFormOf = (
    replyDraft: string,
    selectedId: string | null,
    setReplyDrafts: import("react").Dispatch<import("react").SetStateAction<Drafts>>,
    conversation: ChatbotConversation | null,
    userName: string,
    actions: ReturnType<typeof useChatbotActions>,
): ChatbotTextFormOptions => {
    return {
        draft: replyDraft,
        tooLong: "replyTooLong",
        onDraft: (value) => {
            if (selectedId !== null) setReplyDrafts((current) => ({ ...current, [selectedId]: value }))
        },
        onSubmit: async (body) => {
            if (selectedId === null || conversation?.handledBy !== userName || userName === "") return
            const queued = await actions.sendReply(selectedId, body)
            if (queued)
                setReplyDrafts((current) =>
                    current[selectedId] === replyDraft ? { ...current, [selectedId]: "" } : current,
                )
        },
    }
}
