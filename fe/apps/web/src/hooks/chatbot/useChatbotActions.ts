import { useLocale, useTranslations } from "next-intl"
import { useCallback } from "react"
import { useSWRConfig } from "swr"
import { useMutateRequestChatAnswerSwr } from "@/hooks/swr/api/graphql/mutations/useMutateRequestChatAnswerSwr"
import { useMutateRequestChatReplySwr } from "@/hooks/swr/api/graphql/mutations/useMutateRequestChatReplySwr"
import { useMutateSetChatHandlingSwr } from "@/hooks/swr/api/graphql/mutations/useMutateSetChatHandlingSwr"
import {
    QUERY_CHAT_ANSWER_STATUS_SWR_KEY,
    useQueryChatAnswerStatusSwr,
} from "@/hooks/swr/api/graphql/queries/useQueryChatAnswerStatusSwr"
import {
    QUERY_CHAT_REPLY_STATUS_SWR_KEY,
    useQueryChatReplyStatusSwr,
} from "@/hooks/swr/api/graphql/queries/useQueryChatReplyStatusSwr"
import { CHATBOT_IDLE, useChatbotStore } from "@/hooks/zustand/chatbot"
import { useGraphQLWithToast } from "@/modules/toast"
import type { ChatbotTranslator } from "./chatbot.shared"

/** The SWR keys whose data a finished delivery or a decision changes. */
const REFRESHED_KEYS: ReadonlyArray<unknown> = [
    "QUERY_CHATBOT_OVERVIEW_SWR",
    "QUERY_CHATBOT_THREAD_SWR",
    "QUERY_CHATBOT_GAPS_SWR",
    "QUERY_CHATBOT_AGENT_DASHBOARD_SWR",
]

/** What the status poll reports about a queued delivery. */
interface DeliveryProgress {
    readonly status: string
}

/** The words of a finished delivery. */
const noticeOf = (t: ChatbotTranslator, kind: "reply" | "answer", declined: boolean, status: string): string => {
    if (status === "failed") return t(kind === "reply" ? "replyFailed" : "answerFailed")
    if (kind === "reply") return t("replySent")
    return t(declined ? "answerDeclined" : "answerSent")
}

/** Queues replies and decisions, then follows durable GraphQL status. Browser-lifetime locks survive workspace and installation changes. */
export const useChatbotActions = (workspaceId: string, userId: string) => {
    const t = useTranslations("workbenchChatbot")
    const locale = useLocale()
    const runGraphQL = useGraphQLWithToast()
    const { mutate } = useSWRConfig()
    const identity = `${workspaceId}:${userId}`
    const state = useChatbotStore((store) => store.actions[identity] ?? CHATBOT_IDLE)
    const job = state.job
    const reply = useMutateRequestChatReplySwr()
    const answer = useMutateRequestChatAnswerSwr()
    const handling = useMutateSetChatHandlingSwr()

    const refresh = useCallback(
        () => mutate((key) => Array.isArray(key) && key[1] === workspaceId && REFRESHED_KEYS.includes(key[0])),
        [mutate, workspaceId],
    )

    const settle = (progress: DeliveryProgress) => {
        if (job === undefined || (progress.status !== "succeeded" && progress.status !== "failed")) return
        const message = noticeOf(t, job.kind, job.declined, progress.status)
        const feedback =
            progress.status === "failed" ? { conversationId: job.conversationId, kind: job.kind, message } : null
        if (!useChatbotStore.getState().finish(identity, job, feedback)) return
        void runGraphQL(
            () => (progress.status === "failed" ? Promise.reject(new Error(message)) : Promise.resolve(progress)),
            { successMessage: message },
        )
        void refresh()
    }

    const reportReadError = (error: unknown) => {
        if (job === undefined) return
        const key = error instanceof Error ? error.message : "error"
        if (!useChatbotStore.getState().reportReadError(identity, job, key)) return
        void runGraphQL(() => Promise.reject(error))
    }

    const followed = { onSuccess: settle, onError: reportReadError }
    useQueryChatReplyStatusSwr(workspaceId, job?.kind === "reply" ? job.id : undefined, followed)
    useQueryChatAnswerStatusSwr(workspaceId, job?.kind === "answer" ? job.id : undefined, followed)

    const sendReply = async (conversationId: string, body: string): Promise<boolean> => {
        if (userId === "" || !useChatbotStore.getState().start(identity, "reply")) return false
        const result = await runGraphQL(() => reply.trigger({ conversationId, body, locale }), {
            successMessage: t("replyQueued"),
        })
        if (result === undefined) {
            useChatbotStore.getState().release(identity)
            return false
        }
        const id = result.messageId ?? result.id
        await mutate([QUERY_CHAT_REPLY_STATUS_SWR_KEY, workspaceId, id], undefined, { revalidate: false })
        useChatbotStore.getState().queued(identity, { kind: "reply", conversationId, id, declined: false })
        void refresh()
        return true
    }

    const sendAnswer = async (conversationId: string, workItemId: string, text: string | null): Promise<void> => {
        if (userId === "" || !useChatbotStore.getState().start(identity, "answer")) return
        const result = await runGraphQL(() => answer.trigger({ conversationId, workItemId, text, locale }), {
            successMessage: t("answerQueued"),
        })
        if (result === undefined) {
            useChatbotStore.getState().release(identity)
            return
        }
        await mutate([QUERY_CHAT_ANSWER_STATUS_SWR_KEY, workspaceId, workItemId], undefined, { revalidate: false })
        useChatbotStore
            .getState()
            .queued(identity, { kind: "answer", conversationId, id: workItemId, declined: text === null })
        void refresh()
    }

    const toggleHandling = async (conversationId: string, takeOver: boolean): Promise<void> => {
        if (userId === "" || !useChatbotStore.getState().start(identity, "handling")) return
        const result = await runGraphQL(() => handling.trigger({ conversationId, takeOver, locale }), {
            successMessage: t(takeOver ? "handlingTakenOver" : "handlingReleased"),
        })
        useChatbotStore.getState().release(identity)
        if (result !== undefined) await refresh()
    }

    return {
        sendReply,
        sendAnswer,
        toggleHandling,
        feedback: state.feedback,
        busy: state.requesting ?? job?.kind ?? null,
    }
}
