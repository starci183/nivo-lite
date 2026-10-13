import { useEffect, useRef } from "react"
import { subscribeToWorkspaceChanges } from "@/modules/db/browser"

const REFRESH_DEBOUNCE_MS = 600

/**
 * Calls `onChange` (debounced) when a message, a conversation or a work item of the workspace changes: a new line, a taken-over
 * conversation, a question raised or answered. The work-item change is reported as the table it came from.
 */
export const useChatbotRealtime = (workspaceId: string, onChange: (table: string) => void) => {
    const latest = useRef(onChange)
    useEffect(() => {
        latest.current = onChange
    }, [onChange])
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined
        const stop = subscribeToWorkspaceChanges({
            channel: `chatbot-workbench-${workspaceId}`,
            workspaceId,
            tables: ["agent_messages", "agent_conversations", "work_items"],
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
