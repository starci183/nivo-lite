"use client"

import type { useGraphQLWithToast } from "@/modules/toast"
import { useState } from "react"
import type { useTranslations } from "next-intl"
import type { useAgentChatMessageForm, useAgentChatVisitorForm } from "@/hooks/rhf"
import type { useMutateSendAgentChatMessageSwr, useMutateStartAgentChatConversationSwr } from "@/hooks/swr"
import type { AgentChatActionTarget, PendingTurn } from "./useAgentChatActions"

/** A single-flight lock: acquire answers false while another command holds it. */
const createCommandLock = (): CommandLock => {
    let held = false
    return {
        acquire: () => {
            if (held) return false
            held = true
            return true
        },
        release: () => {
            held = false
        },
    }
}
/** A command batch adds the shared single-flight lock to the selected conversation inputs. */
interface AgentChatCommandInput extends AgentChatCommandsInput {
    readonly lock: CommandLock
}

const createAgentChatActionsActions = ({
    target,
    visitor,
    runGraphQL,
    startMutation,
    t,
    refresh,
    lock,
    pending,
    setOpening,
    setTurnError,
    message,
    workspaceId,
    sendMutation,
    setPending,
}: AgentChatCommandInput) => {
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
        if (target.agent === undefined || pending !== undefined || !lock.acquire()) return
        setOpening(true)
        setTurnError(null)
        message.clearErrors()
        try {
            await open()
        } finally {
            lock.release()
            setOpening(false)
        }
    }

    const send = async (prompt?: string) => {
        if (workspaceId === undefined || pending !== undefined || !lock.acquire()) return
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
            lock.release()
        }
    }
    return { start, send }
}

/** Owns the chat command lock and its actions. */
export const useAgentChatCommands = (input: AgentChatCommandsInput) => {
    const {
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
    } = input

    const [lock] = useState(createCommandLock)
    return createAgentChatActionsActions({
        target,
        visitor,
        runGraphQL,
        startMutation,
        t,
        refresh,
        lock,
        pending,
        setOpening,
        setTurnError,
        message,
        workspaceId,
        sendMutation,
        setPending,
    })
}

/** The single-flight lock shared by start and send. */
interface CommandLock {
    readonly acquire: () => boolean
    readonly release: () => void
}

/** The selected conversation, forms and commands that a chat command batch operates on. */
interface AgentChatCommandsInput {
    readonly target: AgentChatActionTarget
    readonly visitor: ReturnType<typeof useAgentChatVisitorForm>
    readonly runGraphQL: ReturnType<typeof useGraphQLWithToast>
    readonly startMutation: ReturnType<typeof useMutateStartAgentChatConversationSwr>
    readonly t: ReturnType<typeof useTranslations<"agentChat">>
    readonly refresh: (conversationId: string) => Promise<void>
    readonly pending: PendingTurn | undefined
    readonly setOpening: import("react").Dispatch<import("react").SetStateAction<boolean>>
    readonly setTurnError: import("react").Dispatch<import("react").SetStateAction<string | null>>
    readonly message: ReturnType<typeof useAgentChatMessageForm>
    readonly workspaceId: string | undefined
    readonly sendMutation: ReturnType<typeof useMutateSendAgentChatMessageSwr>
    readonly setPending: import("react").Dispatch<import("react").SetStateAction<PendingTurn | undefined>>
}
