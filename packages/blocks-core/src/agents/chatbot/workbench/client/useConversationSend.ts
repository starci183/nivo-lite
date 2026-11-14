import { useEffect, useReducer, useRef, useState } from "react"
import type { ActionHandle } from "@nivo-lite/agent-sdk/block"
import { canSend, textToSend } from "../rows/conversation-draft"
import { pendingReducer } from "../rows/conversation-pending"
import type { PendingSend } from "../rows/conversation.types"

/** What the composer of one thread keeps locally and the ways it changes it. */
export interface ConversationSend {
    /** The words in the composer. */
    readonly draft: string
    /** Changes the words in the composer. */
    readonly setDraft: (draft: string) => void
    /** The messages sent that the thread has not confirmed. */
    readonly pending: ReadonlyArray<PendingSend>
    /** Whether the send control works. */
    readonly canSend: boolean
    /** Sends the draft: the message shows at once and the draft clears; a failure marks the message, never loses it. */
    readonly send: () => void
    /** Sends a message that failed again, where it stands. */
    readonly retry: (key: string) => void
    /** Drops a message that failed. */
    readonly discard: (key: string) => void
}

/**
 * The local state of the composer of one thread: the draft and the optimistic sends (WORKBENCH-SPEC "State management" 4 and 5).
 * The draft is cleared when the thread changes because the pane is keyed by the thread.
 */
export const useConversationSend = (
    threadId: string,
    action: ActionHandle,
    maxLength: number,
    lastId: string | null,
): ConversationSend => {
    const [draft, setDraft] = useState("")
    const [pending, dispatch] = useReducer(pendingReducer, [])
    const counter = useRef(0)

    useEffect(() => {
        dispatch({ type: "settle", lastId })
    }, [lastId, pending])

    const deliver = (key: string, text: string): void => {
        action.run({ id: threadId, values: { text } }).then(
            (outcome) => dispatch({ type: outcome.ok ? "done" : "fail", key }),
            () => dispatch({ type: "fail", key }),
        )
    }

    return {
        draft,
        setDraft,
        pending,
        canSend: canSend(draft, maxLength, action.isRunning),
        send: () => {
            if (!canSend(draft, maxLength, action.isRunning)) return
            counter.current += 1
            const key = `pending-${counter.current}`
            const text = textToSend(draft)
            setDraft("")
            dispatch({ type: "queue", key, text, afterId: lastId })
            deliver(key, text)
        },
        retry: (key) => {
            const entry = pending.find((candidate) => candidate.key === key)
            if (entry === undefined) return
            dispatch({ type: "retry", key })
            deliver(key, entry.text)
        },
        discard: (key) => dispatch({ type: "discard", key }),
    }
}
