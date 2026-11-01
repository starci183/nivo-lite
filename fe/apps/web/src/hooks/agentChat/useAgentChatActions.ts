"use client"

import { useAgentChatCommands } from "./useAgentChatCommands"
import { useAgentChatTurnLifecycle } from "./useAgentChatTurnLifecycle"
import { useAgentChatMessageForm, useAgentChatVisitorForm } from "@/hooks/rhf"
import {
    useMutateRequestAgentChatFileUploadSwr,
    useMutateSendAgentChatMessageSwr,
    useMutateStartAgentChatConversationSwr,
    useMutateTakeOverAgentChatConversationSwr,
} from "@/hooks/swr"
import { useChatFile } from "@/hooks/chatFile"
import { useGraphQLWithToast } from "@/modules/toast"
import { useTranslations } from "next-intl"
import { useState } from "react"
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

/** Validated chat writes, mutation feedback and the authoritative queued-turn lifecycle. */
export const useAgentChatActions = (target: AgentChatActionTarget) => {
    const t = useTranslations("agentChat")
    const system = useTranslations("system")
    const runGraphQL = useGraphQLWithToast()
    const file = useChatFile()
    const message = useAgentChatMessageForm()
    const visitor = useAgentChatVisitorForm()
    const workspaceId = target.agent?.workspaceId
    const startMutation = useMutateStartAgentChatConversationSwr(workspaceId ?? "")
    const sendMutation = useMutateSendAgentChatMessageSwr(workspaceId ?? "")
    const takeoverMutation = useMutateTakeOverAgentChatConversationSwr(workspaceId ?? "")
    const uploadMutation = useMutateRequestAgentChatFileUploadSwr(workspaceId ?? "")

    const [isOpening, setIsOpening] = useState(false)
    const [pendingTurn, setPendingTurn] = useState<PendingTurn>()
    const pending = pendingTurn?.workspaceId === workspaceId ? pendingTurn : undefined
    const [turnError, setTurnError] = useState<string | null>(null)
    const { status, refresh } = useAgentChatTurnLifecycle({ target, pending, setPendingTurn, setTurnError })

    const { start, send } = useAgentChatCommands({
        target,
        visitor,
        runGraphQL,
        startMutation,
        t,
        refresh,
        pending,
        setOpening: setIsOpening,
        setTurnError,
        message,
        workspaceId,
        sendMutation,
        setPending: setPendingTurn,
        uploadMutation,
        file,
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
        file: file.file,
        chooseFile: file.choose,
        clearFile: file.clear,
        isSending:
            sendMutation.isMutating ||
            uploadMutation.isMutating ||
            message.formState.isSubmitting ||
            pending !== undefined,
        isAwaitingReply: target.selectedId !== null && pending?.conversationId === target.selectedId,
        isStarting: isOpening || startMutation.isMutating,
        isTakingOver: takeoverMutation.isMutating,
        error:
            turnError ??
            (file.problem === null ? null : t(file.problem)) ??
            message.formState.errors.body?.message ??
            visitor.formState.errors.visitorName?.message ??
            (status.error instanceof Error ? status.error.message : null),
    }
}
