"use client"

import { useAgentChatCommands } from "./useAgentChatCommands"
import { useAgentChatMessageForm, useAgentChatVisitorForm } from "@/hooks/rhf"
import {
    QUERY_AGENT_CHAT_CONVERSATIONS_SWR_KEY,
    QUERY_AGENT_CHAT_MESSAGES_SWR_KEY,
    useMutateSendAgentChatMessageSwr,
    useMutateStartAgentChatConversationSwr,
    useMutateTakeOverAgentChatConversationSwr,
    useQueryAgentChatTurnStatusSwr,
} from "@/hooks/swr"
import type { AgentChatTurnStatusType } from "@/hooks/swr"
import { toast, useGraphQLWithToast } from "@/modules/toast"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useSWRConfig } from "swr"
import type { AgentChatAgent, ChatTab } from "./useAgentChat"

/** The selected thread and the way an opened thread becomes selected. */
export interface AgentChatActionTarget {
    readonly agent: AgentChatAgent | undefined
    readonly selectedId: string | null
    readonly tab: ChatTab
    readonly isTakenOver: boolean
    readonly opened: (kind: ChatTab, id: string) => void
}

/** A message that was accepted and whose queued turn has not finished yet. */
export interface PendingTurn {
    readonly workspaceId: string
    readonly id: string
    readonly conversationId: string
    readonly delivery: boolean
}

/** A claim that settles each finished turn once; false when that turn was already settled. */
const createTurnClaim = (): ((id: string) => boolean) => {
    let settled: string | undefined
    return (id) => {
        if (settled === id) return false
        settled = id
        return true
    }
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

    const [isOpening, setOpening] = useState(false)
    const [pendingTurn, setPending] = useState<PendingTurn>()
    const pending = pendingTurn?.workspaceId === workspaceId ? pendingTurn : undefined
    const [turnError, setTurnError] = useState<string | null>(null)
    const [claimTurn] = useState(createTurnClaim)

    const { settle, refresh } = createAgentChatActionsActions3(
        target,
        mutate,
        pending,
        claimTurn,
        setPending,
        t,
        setTurnError,
    )
    const status = useQueryAgentChatTurnStatusSwr(workspaceId, pending?.id, settle)

    const { start, send } = useAgentChatCommands({
        target,
        visitor,
        runGraphQL,
        startMutation,
        t,
        refresh,
        pending,
        setOpening,
        setTurnError,
        message,
        workspaceId,
        sendMutation,
        setPending,
    })

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

const createAgentChatActionsActions3 = (
    target: AgentChatActionTarget,
    mutate: ReturnType<typeof useSWRConfig>["mutate"],
    pending: PendingTurn | undefined,
    claimTurn: (id: string) => boolean,
    setPending: import("react").Dispatch<import("react").SetStateAction<PendingTurn | undefined>>,
    t: ReturnType<typeof useTranslations<"agentChat">>,
    setTurnError: import("react").Dispatch<import("react").SetStateAction<string | null>>,
) => {
    const refresh = async (conversationId: string) => {
        if (target.agent === undefined) return
        await Promise.all([
            mutate([QUERY_AGENT_CHAT_CONVERSATIONS_SWR_KEY, target.agent.workspaceId, target.agent.agentId]),
            mutate([QUERY_AGENT_CHAT_MESSAGES_SWR_KEY, target.agent.workspaceId, conversationId]),
        ])
    }

    const settle = (turn: AgentChatTurnStatusType) => {
        if (pending === undefined || turn.id !== pending.id || !claimTurn(turn.id)) return
        setPending(undefined)
        if (turn.status === "succeeded") toast.success(t(pending.delivery ? "deliverySucceeded" : "replyReady"))
        else {
            const reason = t(failureKeyOf(turn))
            setTurnError(reason)
            toast.danger(reason)
        }
        void refresh(turn.conversationId)
    }
    return { settle, refresh }
}
