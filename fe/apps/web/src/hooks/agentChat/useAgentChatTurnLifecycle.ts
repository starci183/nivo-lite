"use client"

import {
    QUERY_AGENT_CHAT_CONVERSATIONS_SWR_KEY,
    QUERY_AGENT_CHAT_MESSAGES_SWR_KEY,
    useQueryAgentChatTurnStatusSwr,
    type AgentChatTurnStatusType,
} from "@/hooks/swr"
import { toast } from "@/modules/toast"
import { useTranslations } from "next-intl"
import { useRef, type Dispatch, type SetStateAction } from "react"
import { useSWRConfig } from "swr"
import type { AgentChatActionTarget, PendingTurn } from "./useAgentChatActions"

/** The active thread and the state a terminal turn settles. */
interface AgentChatTurnLifecycleInput {
    readonly target: AgentChatActionTarget
    readonly pending: PendingTurn | undefined
    readonly setPendingTurn: Dispatch<SetStateAction<PendingTurn | undefined>>
    readonly setTurnError: Dispatch<SetStateAction<string | null>>
}

/** The line the queued-turn failure shows. */
const failureKeyOf = (turn: AgentChatTurnStatusType) =>
    turn.errorCode === "CHAT_DELIVERY_FAILED" ? "deliveryFailed" : "turnFailed"

/** Polls the active queued turn and settles its feedback and cache refresh once. */
export const useAgentChatTurnLifecycle = ({
    target,
    pending,
    setPendingTurn,
    setTurnError,
}: AgentChatTurnLifecycleInput) => {
    const t = useTranslations("agentChat")
    const { mutate } = useSWRConfig()
    const settledTurn = useRef<string | undefined>(undefined)
    const refresh = async (conversationId: string) => {
        if (target.agent === undefined) return
        await Promise.all([
            mutate([QUERY_AGENT_CHAT_CONVERSATIONS_SWR_KEY, target.agent.workspaceId, target.agent.agentId]),
            mutate([QUERY_AGENT_CHAT_MESSAGES_SWR_KEY, target.agent.workspaceId, conversationId]),
        ])
    }
    const status = useQueryAgentChatTurnStatusSwr(target.agent?.workspaceId, pending?.id, (turn) => {
        if (pending === undefined || turn.id !== pending.id || settledTurn.current === turn.id) return
        settledTurn.current = turn.id
        setPendingTurn(undefined)
        if (turn.status === "succeeded") toast.success(t(pending.delivery ? "deliverySucceeded" : "replyReady"))
        else {
            const reason = t(failureKeyOf(turn))
            setTurnError(reason)
            toast.danger(reason)
        }
        void refresh(turn.conversationId)
    })
    return { status, refresh }
}
