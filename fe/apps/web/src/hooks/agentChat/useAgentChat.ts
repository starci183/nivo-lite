import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { useFormatter, useTranslations } from "next-intl"
import { readAgentConversations } from "@/modules/db/agentchat/read-agent-conversations"
import { readAgentMessages } from "@/modules/db/agentchat/read-agent-messages"
import { writeSendMessage } from "@/modules/db/agentchat/write-send-message"
import { writeStartConversation } from "@/modules/db/agentchat/write-start-conversation"
import { writeTakeOver } from "@/modules/db/agentchat/write-take-over"
import type { AgentChatConversation, AgentChatKind, AgentChatMessage } from "@/modules/db/agentchat/agentchat.mapper"
import { navigation } from "@/modules/i18n"
import { useAgentChatRealtime } from "./useAgentChatRealtime"

/** What the hook needs to know about the agent and where the page started. */
export interface AgentChatSession {
    readonly agentId: string
    readonly workspaceId: string | null
    readonly hasCustomerChannel: boolean
    readonly initialTab: AgentChatKind
    readonly initialConversationId: string | null
}

/** How long the thread keeps showing "typing" while it waits for the back end to answer. */
const REPLY_WAIT_MS = 60_000

/** The conversation the owner holds right now: one id per tab. */
type Selected = Readonly<Record<AgentChatKind, string | null>>

/** The conversations, the open thread, the composer and the commands of the agent chat. */
export const useAgentChat = (session: AgentChatSession) => {
    const t = useTranslations("agentChat")
    const system = useTranslations("system")
    const format = useFormatter()
    const router = navigation.useRouter()
    const [tab, setTab] = useState<AgentChatKind>(session.hasCustomerChannel ? session.initialTab : "test")
    const [conversations, setConversations] = useState<ReadonlyArray<AgentChatConversation>>([])
    const [isLoadingList, setIsLoadingList] = useState(true)
    const [selected, setSelected] = useState<Selected>({
        test: session.initialTab === "test" ? session.initialConversationId : null,
        customer: session.initialTab === "customer" ? session.initialConversationId : null,
    })
    const [messages, setMessages] = useState<ReadonlyArray<AgentChatMessage>>([])
    const [draft, setDraft] = useState("")
    const [visitorName, setVisitorName] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [awaiting, setAwaiting] = useState<string | null>(null)
    const [isSending, startSending] = useTransition()
    const [isStarting, startStarting] = useTransition()
    const [isTakingOver, startTakingOver] = useTransition()

    const selectedId = selected[tab]
    const selectedConversation = conversations.find((item) => item.id === selectedId) ?? null
    const isTakenOver = tab === "customer" && selectedConversation !== null && selectedConversation.handledBy !== null

    const reloadConversations = useCallback(async () => {
        const outcome = await readAgentConversations(session.agentId)
        if (outcome.kind === "ok") setConversations(outcome.value)
        setIsLoadingList(false)
    }, [session.agentId])

    const reloadMessages = useCallback(async (conversationId: string) => {
        const outcome = await readAgentMessages(conversationId)
        if (outcome.kind === "ok") setMessages(outcome.value)
    }, [])

    useEffect(() => {
        void reloadConversations()
    }, [reloadConversations])

    useEffect(() => {
        setError(null)
        if (selectedId === null) {
            setMessages([])
            return
        }
        void reloadMessages(selectedId)
    }, [selectedId, reloadMessages])

    useAgentChatRealtime(session.workspaceId, (table) => {
        if (table === "agent_conversations") void reloadConversations()
        if (selectedId !== null) void reloadMessages(selectedId)
    })

    // The wait for the back end ends with the first line after the message, or after a minute.
    const last = messages.at(-1)
    useEffect(() => {
        if (awaiting === null) return undefined
        if (last !== undefined && last.id !== awaiting && last.role !== "user") {
            setAwaiting(null)
            return undefined
        }
        const timer = setTimeout(() => setAwaiting(null), REPLY_WAIT_MS)
        return () => clearTimeout(timer)
    }, [awaiting, last])

    const failure = useCallback(
        (code: string): string => (code === "agent-chat-body" ? t("emptyMessage") : t("notSentReason")),
        [t],
    )

    const open = useCallback(
        async (kind: AgentChatKind): Promise<string | null> => {
            const outcome = await writeStartConversation({
                agentId: session.agentId,
                kind,
                visitorName: kind === "customer" ? visitorName : null,
            })
            if (outcome.kind !== "ok") {
                setError(failure(outcome.code))
                return null
            }
            setSelected((current) => ({ ...current, [kind]: outcome.value }))
            setVisitorName("")
            await reloadConversations()
            return outcome.value
        },
        [session.agentId, visitorName, reloadConversations, failure],
    )

    const start = () => {
        setError(null)
        startStarting(async () => {
            await open(tab)
        })
    }

    const send = (prompt?: string) => {
        const body = (prompt ?? draft).trim()
        if (body === "") return
        setError(null)
        if (prompt === undefined) setDraft("")
        startSending(async () => {
            const conversationId = selectedId ?? (await open(tab))
            if (conversationId === null) {
                if (prompt === undefined) setDraft(body)
                return
            }
            const outcome = await writeSendMessage({ conversationId, body })
            if (outcome.kind !== "ok") {
                setError(failure(outcome.code))
                if (prompt === undefined) setDraft(body)
                return
            }
            if (!isTakenOver) setAwaiting(outcome.value)
            await reloadMessages(conversationId)
        })
    }

    const toggleTakeover = () => {
        if (selectedId === null) return
        const conversationId = selectedId
        const take = !isTakenOver
        setError(null)
        startTakingOver(async () => {
            const outcome = await writeTakeOver({
                conversationId,
                take,
                line: take ? system("takenOver", { user: "{user}" }) : system("returnedToAi", { user: "{user}" }),
            })
            if (outcome.kind !== "ok") {
                setError(failure(outcome.code))
                return
            }
            await Promise.all([reloadConversations(), reloadMessages(conversationId)])
        })
    }

    const changeTab = (next: AgentChatKind) => {
        setTab(next)
        router.replace(`/modules/${session.agentId}/chat?tab=${next}`, { scroll: false })
    }

    const rows = useMemo(
        () =>
            conversations.map((item) => ({
                id: item.id,
                kind: item.kind,
                hasLead: item.leadId !== null,
                title: item.kind === "customer" ? (item.visitorName ?? t("websiteVisitor")) : t("testConversation"),
                kindLabel:
                    item.kind === "customer"
                        ? item.channel === "telegram"
                            ? `${t("kindCustomer")} · Telegram`
                            : t("kindCustomer")
                        : t("kindTest"),
                timeLabel: format.dateTime(new Date(item.createdAt), {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                }),
                isSelected: item.id === selected[item.kind],
            })),
        [conversations, selected, t, format],
    )

    const thread = useMemo(
        () =>
            messages.map((item) => ({
                id: item.id,
                role: item.role,
                body: item.body,
                timeLabel: format.dateTime(new Date(item.createdAt), {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                }),
            })),
        [messages, format],
    )

    return {
        tab,
        rows,
        thread,
        draft,
        visitorName,
        error,
        isLoadingList,
        isSending: isSending || awaiting !== null,
        isStarting,
        isTakingOver,
        isTakenOver,
        hasSelection: selectedId !== null,
        leadId: tab === "customer" ? (selectedConversation?.leadId ?? null) : null,
        setDraft,
        setVisitorName,
        start,
        send,
        toggleTakeover,
        changeTab,
        select: (conversationId: string, kind: AgentChatKind) => {
            setSelected((current) => ({ ...current, [kind]: conversationId }))
            changeTab(kind)
        },
    }
}
