"use client"

import { useChatbotTextForm } from "@/hooks/rhf"
import { useGraphQLWithToast } from "@/modules/toast"
import type { ChatbotTextFormOptions } from "@/hooks/rhf"
import { useChatbotInboxView } from "./useChatbotInboxView"
import { useChatbotInboxScope } from "./useChatbotInboxScope"
import { useChatbotActions, useChatbotThread } from "@/hooks/chatbot"
import type { InboxFilter } from "@/hooks/chatbot"
import { navigation } from "@/modules/i18n"
import type { ChatbotConversation, ChatbotOverview, ChatbotThread } from "@/modules/types"
import { useTranslations } from "next-intl"

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

/** The words, rows and actions of the inbox: validated drafts, queued replies, the open thread. Drafts stay tied to their conversation or escalation. */
export const useChatbotInbox = (
    input: ChatbotInboxInput,
    isActive = true,
    scope = JSON.stringify([input.overview?.workspaceId, input.userId]),
) => {
    const runGraphQL = useGraphQLWithToast()
    const { overview, userName, userId } = input
    const t = useTranslations("workbenchChatbot")

    const router = navigation.useRouter()
    const pathname = navigation.usePathname()

    const {
        view,
        setView,
        replyDrafts,
        setReplyDrafts,
        answerDrafts,
        setAnswerDrafts,
        isNavigating,
        startNavigation,
        lifetime,
    } = useChatbotInboxScope(isActive, scope)
    const selectedId = isNavigating && view.pickedId !== null ? view.pickedId : input.selectedId
    const threadQuery = useChatbotThread(
        isActive ? overview?.workspaceId : undefined,
        isActive ? (selectedId ?? undefined) : undefined,
    )
    const actions = useChatbotActions(overview?.workspaceId ?? "", userId, isActive)
    const thread = threadQuery.data ?? null
    const conversation = thread?.conversation ?? null
    const escalation = thread?.escalation ?? null
    const name = conversation?.name || t("unknownCustomer")
    const replyDraft = selectedId === null ? "" : (replyDrafts[selectedId] ?? "")
    const answerDraft = escalation === null ? "" : (answerDrafts[escalation.workItemId] ?? escalation.draft)
    const feedback =
        actions.feedback !== null && actions.feedback.conversationId === selectedId ? actions.feedback : null
    const commandContext = { selectedId, actions, lifetime, runGraphQL }
    const replyForm = useChatbotTextForm({
        ...replyFormOf({
            ...commandContext,
            replyDraft,
            setReplyDrafts,
            conversation,
            userName,
        }),
        isActive,
        scope,
    })
    const answerForm = useChatbotTextForm({
        ...answerFormOf({ ...commandContext, answerDraft, setAnswerDrafts, escalation }),
        isActive,
        scope,
    })

    const actionError = () => inboxActionErrorOf(threadQuery.error, feedback)
    return useChatbotInboxView({
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
        activity: { isActive, scope },
    })
}

/** The real thread read error precedes handling feedback for this same conversation. */
const inboxActionErrorOf = (
    error: unknown,
    feedback: ReturnType<typeof useChatbotActions>["feedback"],
): string | null => {
    if (error instanceof Error) return error.message
    return feedback?.kind === "handling" ? feedback.message : null
}

/** The actual current conversation and the local completion scope of its reply form. */
interface DraftCommandContext {
    readonly runGraphQL: ReturnType<typeof useGraphQLWithToast>
    readonly selectedId: string | null
    readonly actions: ReturnType<typeof useChatbotActions>
    readonly lifetime: ReturnType<typeof useChatbotInboxScope>["lifetime"]
}

interface ReplyFormInput extends DraftCommandContext {
    readonly replyDraft: string
    readonly setReplyDrafts: ReturnType<typeof useChatbotInboxScope>["setReplyDrafts"]
    readonly conversation: ChatbotConversation | null
    readonly userName: string
}

const replyFormOf = (input: ReplyFormInput): ChatbotTextFormOptions => {
    const { replyDraft, selectedId, setReplyDrafts, conversation, userName, actions, lifetime, runGraphQL } = input
    return {
        draft: replyDraft,
        tooLong: "replyTooLong",
        onDraft: (value) => {
            if (selectedId !== null) setReplyDrafts((current) => ({ ...current, [selectedId]: value }))
        },
        onSubmit: (body) => {
            const isCurrent = lifetime.capture()
            if (!isCurrent() || selectedId === null || conversation?.handledBy !== userName || userName === "") return
            actions
                .sendReply(selectedId, body)
                .then((queued) => {
                    if (queued && isCurrent())
                        setReplyDrafts((current) =>
                            current[selectedId] === replyDraft ? { ...current, [selectedId]: "" } : current,
                        )
                })
                .catch((error: unknown) => runGraphQL(() => Promise.reject(error), { showSuccessToast: false }))
        },
    }
}

interface AnswerFormInput extends DraftCommandContext {
    readonly answerDraft: string
    readonly setAnswerDrafts: ReturnType<typeof useChatbotInboxScope>["setAnswerDrafts"]
    readonly escalation: ChatbotThread["escalation"]
}

/** Dispatches the real escalation command without returning its HTTP lifetime to RHF. */
const answerFormOf = (input: AnswerFormInput): ChatbotTextFormOptions => {
    const { selectedId, escalation, actions, lifetime, runGraphQL } = input
    return {
        draft: input.answerDraft,
        tooLong: "answerTooLong",
        onDraft: (value) => {
            if (escalation !== null)
                input.setAnswerDrafts((current) => ({ ...current, [escalation.workItemId]: value }))
        },
        onSubmit: (text) => {
            if (!lifetime.capture()() || selectedId === null || escalation === null) return
            actions
                .sendAnswer(selectedId, escalation.workItemId, text)
                .catch((error: unknown) => runGraphQL(() => Promise.reject(error), { showSuccessToast: false }))
        },
    }
}
