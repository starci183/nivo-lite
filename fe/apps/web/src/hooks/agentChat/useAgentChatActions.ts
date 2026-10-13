import { useTranslations } from "next-intl"
import { useRef, useState } from "react"
import { useSWRConfig } from "swr"
import { useAgentChatMessageForm, useAgentChatVisitorForm } from "@/hooks/rhf"
import {
    useMutateSendAgentChatMessageSwr,
    useMutateStartAgentChatConversationSwr,
    useMutateTakeOverAgentChatConversationSwr,
    QUERY_AGENT_CHAT_CONVERSATIONS_SWR_KEY,
    QUERY_AGENT_CHAT_MESSAGES_SWR_KEY,
    useQueryAgentChatTurnStatusSwr,
} from "@/hooks/swr"
import type { AgentChatTurnStatusType } from "@/modules/api"
import { toast, useGraphQLWithToast } from "@/modules/toast"
import type { AgentChatAgent, ChatTab } from "./useAgentChat"

/** The selected thread and the way an opened thread becomes selected. */
interface AgentChatActionTarget {
    readonly agent: AgentChatAgent | undefined
    readonly selectedId: string | null
    readonly tab: ChatTab
    readonly isTakenOver: boolean
    readonly opened: (kind: ChatTab, id: string) => void
}

/** A message that was accepted and whose queued turn has not finished yet. */
interface PendingTurn {
    readonly workspaceId: string
    readonly id: string
    readonly conversationId: string
    readonly delivery: boolean
}

/** The line the queued-turn failure shows. */
const failureKeyOf = (turn: AgentChatTurnStatusType) =>
    turn.errorCode === "CHAT_DELIVERY_FAILED" ? "deliveryFailed" : "turnFailed"

/** Validated chat writes, mutation feedback and the authoritative queued-turn lifecycle. */
export const useAgentChatActions = (target: AgentChatActionTarget) => {
    const t = useTranslations("agentChat")
    const system = useTranslations("system")
    const runGraphQL = useGraphQLWithToast()
    const { mutate } = useSWRConfig()
    const message = useAgentChatMessageForm()
    const visitor = useAgentChatVisitorForm()
    const workspaceId = target.agent?.workspaceId
    const startMutation = useMutateStartAgentChatConversationSwr(workspaceId ?? "")
    const sendMutation = useMutateSendAgentChatMessageSwr(workspaceId ?? "")
    const takeoverMutation = useMutateTakeOverAgentChatConversationSwr(workspaceId ?? "")
    const composing = useRef(false)
    const [isOpening, setOpening] = useState(false)
    const [pendingTurn, setPending] = useState<PendingTurn>()
    const pending = pendingTurn?.workspaceId === workspaceId ? pendingTurn : undefined
    const [turnError, setTurnError] = useState<string | null>(null)
    const completed = useRef<string | undefined>(undefined)

    const refresh = async (conversationId: string) => {
        if (target.agent === undefined) return
        await Promise.all([
            mutate([QUERY_AGENT_CHAT_CONVERSATIONS_SWR_KEY, target.agent.workspaceId, target.agent.agentId]),
            mutate([QUERY_AGENT_CHAT_MESSAGES_SWR_KEY, target.agent.workspaceId, conversationId]),
        ])
    }

    const settle = (turn: AgentChatTurnStatusType) => {
        if (pending === undefined || turn.id !== pending.id || completed.current === turn.id) return
        completed.current = turn.id
        setPending(undefined)
        if (turn.status === "succeeded") toast.success(t(pending.delivery ? "deliverySucceeded" : "replyReady"))
        else {
            const reason = t(failureKeyOf(turn))
            setTurnError(reason)
            toast.danger(reason)
        }
        void refresh(turn.conversationId)
    }
    const status = useQueryAgentChatTurnStatusSwr(workspaceId, pending?.id, settle)

    const open = async (): Promise<string | undefined> => {
        if (target.agent === undefined) return undefined
        const agentId = target.agent.agentId
        if (target.tab === "customer" && !(await visitor.trigger())) return undefined
        const created = await runGraphQL(
            () =>
                startMutation.trigger({
                    agentId,
                    kind: target.tab,
                    visitorName: target.tab === "customer" ? visitor.getValues("visitorName").trim() || null : null,
                }),
            { successMessage: t("conversationStarted") },
        )
        if (created === undefined) return undefined
        target.opened(target.tab, created.id)
        visitor.reset()
        await refresh(created.id)
        return created.id
    }

    const start = async () => {
        if (target.agent === undefined || composing.current || pending !== undefined) return
        composing.current = true
        setOpening(true)
        setTurnError(null)
        message.clearErrors()
        try {
            await open()
        } finally {
            composing.current = false
            setOpening(false)
        }
    }

    const send = async (prompt?: string) => {
        if (workspaceId === undefined || composing.current || pending !== undefined) return
        composing.current = true
        if (prompt !== undefined) message.setValue("body", prompt)
        setTurnError(null)
        try {
            await message.handleSubmit(async ({ body }) => {
                const conversationId = target.selectedId ?? (await open())
                if (conversationId === undefined) return
                const queued = await runGraphQL(() => sendMutation.trigger({ conversationId, body }), {
                    successMessage: t("messageQueued"),
                })
                if (queued === undefined) return
                if (message.getValues("body").trim() === body) message.reset()
                else message.clearErrors()
                setPending({ workspaceId, id: queued.id, conversationId, delivery: target.isTakenOver })
                await refresh(conversationId)
            })()
        } finally {
            composing.current = false
        }
    }

    const toggleTakeover = async () => {
        if (workspaceId === undefined || target.selectedId === null || takeoverMutation.isMutating) return
        const conversationId = target.selectedId
        const take = !target.isTakenOver
        setTurnError(null)
        const result = await runGraphQL(
            () =>
                takeoverMutation.trigger({
                    conversationId,
                    take,
                    line: take ? system("takenOver", { user: "{user}" }) : system("returnedToAi", { user: "{user}" }),
                }),
            { successMessage: t(take ? "takeoverSucceeded" : "returnSucceeded") },
        )
        if (result !== undefined) await refresh(conversationId)
    }

    return {
        message,
        visitor,
        start,
        send,
        toggleTakeover,
        isSending: sendMutation.isMutating || message.formState.isSubmitting || pending !== undefined,
        isAwaitingReply: pending !== undefined && pending.conversationId === target.selectedId,
        isStarting: isOpening || startMutation.isMutating,
        isTakingOver: takeoverMutation.isMutating,
        error:
            turnError ??
            message.formState.errors.body?.message ??
            visitor.formState.errors.visitorName?.message ??
            (status.error instanceof Error ? status.error.message : null),
    }
}
