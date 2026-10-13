import { useEffect, useRef } from "react"
import { subscribeToWorkspaceChanges } from "@/modules/db/browser"

const REFRESH_DEBOUNCE_MS = 300

/**
 * Calls `onChange` (debounced) when a message or a conversation of the workspace changes: the answer of the back end arriving, a customer on a
 * real channel opening a conversation, a person taking one over. The changed table is reported as it came.
 */
export const useAgentChatRealtime = (workspaceId: string | null, onChange: (table: string) => void) => {
    const latest = useRef(onChange)
    useEffect(() => {
        latest.current = onChange
    }, [onChange])
    useEffect(() => {
        if (workspaceId === null) return undefined
        let timer: ReturnType<typeof setTimeout> | undefined
        const stop = subscribeToWorkspaceChanges({
            channel: `agent-chat-${workspaceId}`,
            workspaceId,
            tables: ["agent_messages", "agent_conversations"],
            onChange: (table) => {
                clearTimeout(timer)
                timer = setTimeout(() => latest.current(table), REFRESH_DEBOUNCE_MS)
            },
        })
        return () => {
            clearTimeout(timer)
            stop()
        }
    }, [workspaceId])
}
