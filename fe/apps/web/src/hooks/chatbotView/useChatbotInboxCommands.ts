"use client"

import type { useChatbotActions } from "@/hooks/chatbot"
import type { useChatbotTextForm } from "@/hooks/rhf"
import type { navigation } from "@/modules/i18n"
import type { ChatbotConversation, ChatbotThread } from "@/modules/types"
import { useGraphQLWithToast } from "@/modules/toast"
import type { useChatbotInboxScope } from "./useChatbotInboxScope"

/** The actual view/form/command dependencies of the Inbox's native interactions. */
interface ChatbotInboxCommandsInput {
    readonly selectedId: string | null
    readonly conversation: ChatbotConversation | null
    readonly escalation: ChatbotThread["escalation"]
    readonly actions: ReturnType<typeof useChatbotActions>
    readonly replyForm: ReturnType<typeof useChatbotTextForm>
    readonly answerForm: ReturnType<typeof useChatbotTextForm>
    readonly setView: ReturnType<typeof useChatbotInboxScope>["setView"]
    readonly startNavigation: ReturnType<typeof useChatbotInboxScope>["startNavigation"]
    readonly router: ReturnType<typeof navigation.useRouter>
    readonly pathname: string
    readonly setQuery: (query: string) => void
    readonly setFilter: (filter: string) => void
}

/** Dispatches the original customer interactions and observes the local validation and command tails. */
export const useChatbotInboxCommands = (input: ChatbotInboxCommandsInput) => {
    const runGraphQL = useGraphQLWithToast()
    const {
        selectedId,
        conversation,
        escalation,
        actions,
        replyForm,
        answerForm,
        setView,
        startNavigation,
        router,
        pathname,
    } = input
    return {
        query: (value: string) => input.setQuery(value),
        filter: (value: string) => input.setFilter(value),
        select: (id: string) => {
            setView((current) => ({ ...current, pane: "thread", pickedId: id }))
            const params = new URLSearchParams(window.location.search)
            params.set("focus", id)
            startNavigation(() => router.replace(`${pathname}?${params.toString()}`))
        },
        back: () => setView((current) => ({ ...current, pane: "list" })),
        toggleInfo: () => setView((current) => ({ ...current, isInfoOpen: !current.isInfoOpen })),
        draft: replyForm.setDraft,
        send: () => {
            replyForm
                .submit()
                .catch((error: unknown) => runGraphQL(() => Promise.reject(error), { showSuccessToast: false }))
        },
        toggleHandling: () => {
            if (selectedId !== null && conversation !== null)
                actions
                    .toggleHandling(selectedId, conversation.handledBy === null)
                    .catch((error: unknown) => runGraphQL(() => Promise.reject(error), { showSuccessToast: false }))
        },
        escalationDraft: answerForm.setDraft,
        sendAnswer: () => {
            answerForm
                .submit()
                .catch((error: unknown) => runGraphQL(() => Promise.reject(error), { showSuccessToast: false }))
        },
        declineAnswer: () => {
            if (selectedId !== null && escalation !== null)
                actions
                    .sendAnswer(selectedId, escalation.workItemId, null)
                    .catch((error: unknown) => runGraphQL(() => Promise.reject(error), { showSuccessToast: false }))
        },
    }
}
