import { useFormatter, useTranslations } from "next-intl"
import { useState, useTransition } from "react"
import { isInboxFilter, matchesInboxFilter, useChatbotActions, useChatbotThread } from "@/hooks/chatbot"
import type { InboxFilter } from "@/hooks/chatbot"
import { useChatbotTextForm } from "@/hooks/rhf"
import { navigation } from "@/modules/i18n"
import type { ChatbotOverview } from "@/modules/types"
import { listViewOf, sideViewOf, threadViewOf } from "./chatbotView.shared"

/** Who looks at the inbox, and which conversation the route asks for. */
interface ChatbotInboxInput {
    readonly overview: ChatbotOverview | undefined
    readonly selectedId: string | null
    readonly userName: string
    readonly userId: string
}

/** The list pane or the thread pane, as far as the member chose; `undefined` while the member did not choose. */
interface InboxView {
    readonly pane: "list" | "thread" | undefined
    readonly isInfoOpen: boolean
    readonly pickedId: string | null
}

/** The filter and the text typed in the search box. */
interface InboxFilters {
    readonly filter: InboxFilter
    readonly query: string
}

/** Keeps the draft of a conversation or an escalation by its id. */
type Drafts = Readonly<Record<string, string>>

/** The words, rows and actions of the inbox: validated drafts, queued replies, the open thread. Drafts stay tied to their conversation or escalation. */
export const useChatbotInbox = (input: ChatbotInboxInput) => {
    const { overview, userName, userId } = input
    const t = useTranslations("workbenchChatbot")
    const format = useFormatter()
    const router = navigation.useRouter()
    const pathname = navigation.usePathname()
    const [filters, setFilters] = useState<InboxFilters>({ filter: "all", query: "" })
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
    const replyForm = useChatbotTextForm({
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
    })
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
    if (overview === undefined) return null
    const query = filters.query.trim().toLocaleLowerCase()
    const visible = overview.conversations.filter(
        (item) =>
            matchesInboxFilter(item, filters.filter, overview.nowIso) &&
            (query === "" || `${item.name} ${item.lastText}`.toLocaleLowerCase().includes(query)),
    )
    const actionError = (): string | null => {
        if (threadQuery.error instanceof Error) return threadQuery.error.message
        return feedback?.kind === "handling" ? feedback.message : null
    }
    return {
        props: {
            title: t("title"),
            actionFailedTitle: t("actionFailed"),
            actionError: actionError(),
            pane: view.pane ?? (input.selectedId === null ? ("list" as const) : ("thread" as const)),
            hasSelection: selectedId !== null,
            pickTitle: t("pickTitle"),
            pickBody: t("pickBody"),
            list: listViewOf(t, format, {
                visible,
                total: overview.conversations.length,
                nowIso: overview.nowIso,
                query: filters.query,
                filter: filters.filter,
                selectedId,
            }),
            thread: threadViewOf(t, format, {
                thread,
                isResolving: selectedId !== null && thread === null && !threadQuery.error,
                name,
                nowIso: overview.nowIso,
                userName,
                isInfoOpen: view.isInfoOpen,
                draft: replyDraft,
                error: replyForm.error ?? (feedback?.kind === "reply" ? feedback.message : null),
                isSending: actions.busy !== null,
            }),
            sideLabel: t("customerTitle"),
            isInfoOpen: view.isInfoOpen,
            side: sideViewOf(t, {
                thread,
                name,
                userName,
                answerDraft,
                answerFailure: answerForm.error ?? (feedback?.kind === "answer" ? feedback.message : null),
                busy: actions.busy,
            }),
        },
        on: {
            query: (value: string) => setFilters((current) => ({ ...current, query: value })),
            filter: (value: string) =>
                setFilters((current) => ({ ...current, filter: isInboxFilter(value) ? value : current.filter })),
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
                void replyForm.submit()
            },
            toggleHandling: () => {
                if (selectedId !== null && conversation !== null)
                    void actions.toggleHandling(selectedId, conversation.handledBy === null)
            },
            escalationDraft: answerForm.setDraft,
            answer: (send: boolean) => {
                if (send) void answerForm.submit()
                else if (selectedId !== null && escalation !== null)
                    void actions.sendAnswer(selectedId, escalation.workItemId, null)
            },
        },
    }
}
