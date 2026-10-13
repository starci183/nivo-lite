"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { isInboxFilter, matchesInboxFilter, useChatbotRealtime, type InboxFilter } from "@/hooks/chatbot"
import { listViewOf, sideViewOf, threadViewOf } from "@/hooks/chatbotView"
import { writeChatAnswer } from "@/modules/db/chatreply/write-chat-answer"
import { writeChatHandling } from "@/modules/db/chatreply/write-chat-handling"
import { writeChatReply } from "@/modules/db/chatreply/write-chat-reply"
import { navigation } from "@/modules/i18n"
import type { ChatbotOverview, ChatbotThread } from "@/modules/types"
import { ChatbotInboxBase } from "./component"

/** The conversations, the open thread and who is looking. */
interface ChatbotInboxProps {
    readonly overview: ChatbotOverview
    readonly thread: ChatbotThread | null
    /** The conversation the route asks for; the thread is its reading. */
    readonly selectedId: string | null
    readonly userName: string
}

/** What the member is doing: which pane is open, whether the customer pane is open and which conversation was just picked. */
interface InboxView {
    readonly pane: "list" | "thread"
    readonly isInfoOpen: boolean
    readonly pickedId: string | null
}

/** What went wrong with the last action, and what is running now. */
interface InboxFeedback {
    readonly busy: "reply" | "answer" | "handling" | null
    readonly action: string | null
    readonly reply: string | null
    readonly answer: string | null
}

/** Catalog key of the message a refusal code stands for. */
const FAILURE_KEYS: Readonly<Record<string, string>> = {
    "chat-not-held": "takeOverFirst",
    "chat-body": "emptyReply",
}

const IDLE: InboxFeedback = { busy: null, action: null, reply: null, answer: null }

/** The Chatbot inbox: the filters, the drafts and the commands live here, the drawing in the pure half and the data on the server. */
export const ChatbotInbox = (props: ChatbotInboxProps) => {
    const t = useTranslations("workbenchChatbot")
    const format = useFormatter()
    const router = navigation.useRouter()
    const pathname = navigation.usePathname()
    const [filters, setFilters] = useState<{ filter: InboxFilter; query: string }>({ filter: "all", query: "" })
    const [view, setView] = useState<InboxView>({
        pane: props.selectedId === null ? "list" : "thread",
        isInfoOpen: false,
        pickedId: null,
    })
    const [replyDrafts, setReplyDrafts] = useState<Readonly<Record<string, string>>>({})
    const [answerDrafts, setAnswerDrafts] = useState<Readonly<Record<string, string>>>({})
    const [feedback, setFeedback] = useState<InboxFeedback>(IDLE)
    const [isPending, startTransition] = useTransition()
    useChatbotRealtime(props.overview.workspaceId, () => router.refresh())

    const selectedId = isPending && view.pickedId !== null ? view.pickedId : props.selectedId
    const thread = props.thread?.conversation.id === selectedId ? props.thread : null
    const conversation = thread?.conversation ?? null
    const escalation = thread?.escalation ?? null
    const name = conversation?.name || t("unknownCustomer")
    const replyDraft = selectedId === null ? "" : (replyDrafts[selectedId] ?? "")
    const answerDraft = escalation === null ? "" : (answerDrafts[escalation.workItemId] ?? escalation.draft)
    const query = filters.query.trim().toLocaleLowerCase()
    const visible = props.overview.conversations.filter(
        (item) =>
            matchesInboxFilter(item, filters.filter, props.overview.nowIso) &&
            (query === "" || `${item.name} ${item.lastText}`.toLocaleLowerCase().includes(query)),
    )
    const failureOf = (code: string): string => t(FAILURE_KEYS[code] ?? "loadError")

    const run = (busy: "reply" | "answer" | "handling", action: () => Promise<string | null>) =>
        startTransition(async () => {
            setFeedback({ ...IDLE, busy })
            const failure = await action()
            setFeedback({ ...IDLE, [busy === "handling" ? "action" : busy]: failure })
            if (failure === null) router.refresh()
        })
    const sendReply = () => {
        if (selectedId === null) return
        run("reply", async () => {
            const outcome = await writeChatReply({ conversationId: selectedId, body: replyDraft })
            if (outcome.kind !== "ok") return failureOf(outcome.code)
            setReplyDrafts((current) => ({ ...current, [selectedId]: "" }))
            return null
        })
    }
    const answer = (send: boolean) => {
        if (selectedId === null || escalation === null) return
        run("answer", async () => {
            const outcome = await writeChatAnswer({
                workItemId: escalation.workItemId,
                conversationId: selectedId,
                text: send ? answerDraft : null,
            })
            if (outcome.kind !== "ok") return failureOf(outcome.code)
            const lost = send && !outcome.value.delivered && conversation !== null && conversation.channel !== "website"
            return lost ? t("escalationSentFailed") : null
        })
    }
    const toggleHandling = () => {
        if (selectedId === null || conversation === null) return
        run("handling", async () => {
            const outcome = await writeChatHandling({
                conversationId: selectedId,
                takeOver: conversation.handledBy === null,
            })
            return outcome.kind === "ok" ? null : failureOf(outcome.code)
        })
    }
    const select = (id: string) => {
        setView({ pane: "thread", isInfoOpen: view.isInfoOpen, pickedId: id })
        setFeedback(IDLE)
        startTransition(() => router.replace(`${pathname}?focus=${id}`))
    }

    return (
        <ChatbotInboxBase
            props={{
                title: t("title"),
                actionFailedTitle: t("actionFailed"),
                actionError: feedback.action,
                pane: view.pane,
                hasSelection: selectedId !== null,
                pickTitle: t("pickTitle"),
                pickBody: t("pickBody"),
                list: listViewOf(t, format, {
                    visible,
                    total: props.overview.conversations.length,
                    nowIso: props.overview.nowIso,
                    query: filters.query,
                    filter: filters.filter,
                    selectedId,
                }),
                thread: threadViewOf(t, format, {
                    thread,
                    isResolving: selectedId !== null && thread === null,
                    name,
                    nowIso: props.overview.nowIso,
                    userName: props.userName,
                    isInfoOpen: view.isInfoOpen,
                    draft: replyDraft,
                    error: feedback.reply,
                    isSending: feedback.busy === "reply",
                }),
                sideLabel: t("customerTitle"),
                isInfoOpen: view.isInfoOpen,
                side: sideViewOf(t, {
                    thread,
                    name,
                    userName: props.userName,
                    answerDraft,
                    answerFailure: feedback.answer,
                    busy: feedback.busy,
                }),
            }}
            on={{
                query: (value) => setFilters((current) => ({ ...current, query: value })),
                filter: (value) =>
                    setFilters((current) => ({ ...current, filter: isInboxFilter(value) ? value : current.filter })),
                select,
                back: () => setView((current) => ({ ...current, pane: "list" })),
                toggleInfo: () => setView((current) => ({ ...current, isInfoOpen: !current.isInfoOpen })),
                draft: (value) =>
                    selectedId !== null && setReplyDrafts((current) => ({ ...current, [selectedId]: value })),
                send: sendReply,
                toggleHandling,
                escalationDraft: (value) =>
                    escalation !== null &&
                    setAnswerDrafts((current) => ({ ...current, [escalation.workItemId]: value })),
                answer,
            }}
        />
    )
}
