"use client"

import { useState } from "react"
import { useMutateForwardChatMessageSwr, useQueryChatRoomsSwr } from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import type { TeamChatForwardTarget } from "@/modules/types"
import { roomRowsOf } from "./teamChat.shared"
import { useChatRowWords } from "./useChatRowWords"

/** What the forward dialog needs to know about the open room. */
interface TeamChatForwardInput {
    /** The open room: a message is never forwarded into the room it is in. */
    readonly roomId: string | null
    readonly viewerId: string
    /** Reads the rooms and the unread counts again (the target room has a new message). */
    readonly onForwarded: () => void
}

/** The view `useTeamChatForward` returns. */
export interface TeamChatForwardState {
    /** The message being forwarded, or null while the dialog is closed. */
    readonly messageId: string | null
    /** The rooms are still being read for the first time. */
    readonly isLoading: boolean
    /** The rooms of the viewer other than the open one, with the mark and the last words of each. */
    readonly rooms: ReadonlyArray<TeamChatForwardTarget>
    /** The room the forward is in flight to, or null. */
    readonly sendingId: string | null
    /** The refusal code of the last forward, or "failed" for a transport failure; null when none. */
    readonly error: string | null
    readonly open: (messageId: string) => void
    readonly close: () => void
    /** Forwards the open message into a room; the dialog closes when the door took it. */
    readonly forwardTo: (roomId: string) => Promise<void>
}

/** The dialog that forwards a message of the open room into another room the viewer sits in. */
export const useTeamChatForward = (input: TeamChatForwardInput): TeamChatForwardState => {
    const workspaceId = useWorkspaceId()
    const words = useChatRowWords()
    const rooms = useQueryChatRoomsSwr(workspaceId, {})
    const { trigger } = useMutateForwardChatMessageSwr(workspaceId ?? "")
    const [messageId, setMessageId] = useState<string | null>(null)
    const [sendingId, setSendingId] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const targets = roomRowsOf(rooms.data ?? [], null, input.viewerId, words)
        .filter((row) => row.id !== input.roomId && !row.isNivo)
        .map<TeamChatForwardTarget>((row) => ({
            id: row.id,
            title: row.title,
            subtitle: row.preview,
            mark: row.mark,
        }))
    const close = (): void => {
        setMessageId(null)
        setError(null)
    }
    return {
        messageId,
        isLoading: rooms.isLoading,
        rooms: targets,
        sendingId,
        error,
        open: (id) => {
            setError(null)
            setMessageId(id)
        },
        close,
        forwardTo: async (roomId) => {
            if (messageId === null || sendingId !== null) return
            setSendingId(roomId)
            setError(null)
            try {
                const answer = await trigger({ messageId, roomId })
                if (answer.message === null) {
                    setError(answer.refusal ?? "failed")
                    return
                }
                close()
                input.onForwarded()
            } catch {
                setError("failed")
            } finally {
                setSendingId(null)
            }
        },
    }
}
