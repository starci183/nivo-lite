"use client"

import { useCallback, useMemo, useState } from "react"
import { useMutateSendChatMessageSwr } from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import { mentionsOfDraft } from "@/modules/teamChat"
import type { ChatParty } from "@/modules/types"
import { useTeamChatFile, type TeamChatFilePicker } from "./useTeamChatFile"
import { useTeamChatTypingHint } from "./useTeamChatTypingHint"

/** Where a message goes: the open room, or (the panel of an agent with no room yet) the agent, which opens the room on the write. */
interface TeamChatTarget {
    readonly roomId: string | null
    readonly agentId: string | null
    /** The people and agents of the room the draft may mention. */
    readonly parties: ReadonlyArray<ChatParty>
    /** The message the draft answers; null for none. */
    readonly replyTo: string | null
    /** Called with the id of the room a sent message landed in. */
    readonly onSent: (roomId: string) => void
}

/** The view `useTeamChatComposer` returns. */
export interface TeamChatComposerView {
    readonly draft: string
    readonly file: TeamChatFilePicker
    /** The refusal code of the last send, or "failed" for a transport failure; null when none. */
    readonly error: string | null
    readonly isSending: boolean
    readonly setDraft: (value: string) => void
    readonly send: () => Promise<void>
}

/** The destination of a message, or null when there is none to write to. */
const destinationOf = (target: TeamChatTarget) => {
    if (target.roomId !== null) return { roomId: target.roomId }
    return target.agentId === null ? null : { to: { memberKind: "agent" as const, memberId: target.agentId } }
}

/** The composer of the open room: the draft, the file that goes with it, the typing hint, and the send. */
export const useTeamChatComposer = (target: TeamChatTarget): TeamChatComposerView => {
    const workspaceId = useWorkspaceId() ?? ""
    const send = useMutateSendChatMessageSwr(workspaceId)
    const file = useTeamChatFile(workspaceId)
    const typingHint = useTeamChatTypingHint(workspaceId, target.roomId)
    const [draft, setDraft] = useState("")
    const [error, setError] = useState<string | null>(null)
    const mentions = useMemo(
        () => mentionsOfDraft(draft, target.parties).map((party) => ({ memberKind: party.kind, memberId: party.id })),
        [draft, target.parties],
    )
    const changeDraft = useCallback(
        (value: string): void => {
            setDraft(value)
            setError(null)
            typingHint(value.trim() !== "")
        },
        [typingHint],
    )
    const sendDraft = async (): Promise<void> => {
        const body = draft.trim()
        const destination = destinationOf(target)
        if ((body === "" && file.file === null) || destination === null || send.isMutating) return
        try {
            const fileKey = target.roomId === null ? null : await file.upload(target.roomId)
            if (fileKey === undefined) return
            const sent = await send.trigger({
                ...destination,
                body,
                mentions,
                clientId: crypto.randomUUID(),
                ...(target.replyTo === null ? {} : { replyTo: target.replyTo }),
                ...(fileKey === null ? {} : { fileKeys: [fileKey] }),
            })
            if (sent.message === null) {
                setError(sent.refusal ?? "failed")
                return
            }
            setDraft("")
            file.clear()
            typingHint(false)
            target.onSent(sent.message.roomId)
        } catch {
            setError("failed")
        }
    }
    return {
        draft,
        file,
        error: error ?? file.problem,
        isSending: send.isMutating || file.isUploading,
        setDraft: changeDraft,
        send: sendDraft,
    }
}
