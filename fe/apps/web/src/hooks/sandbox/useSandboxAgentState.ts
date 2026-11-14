"use client"

import { useState } from "react"

/** What the person is doing with the agents of the open account: the attach drawer, what they chose there, the detach they were asked about. */
export interface SandboxAgentState {
    readonly isAttachOpen: boolean
    readonly attachIds: ReadonlyArray<string>
    /** The agent whose detach is asked; null when none is. */
    readonly detachAskId: string | null
    readonly showAttach: () => void
    readonly hideAttach: () => void
    readonly chooseAttach: (agentIds: ReadonlyArray<string>) => void
    readonly askDetach: (agentId: string | null) => void
}

/** The state of the attach drawer and of the detach question; closing the drawer forgets what was chosen. */
export const useSandboxAgentState = (): SandboxAgentState => {
    const [isAttachOpen, setIsAttachOpen] = useState(false)
    const [attachIds, setAttachIds] = useState<ReadonlyArray<string>>([])
    const [detachAskId, setDetachAskId] = useState<string | null>(null)
    return {
        isAttachOpen,
        attachIds,
        detachAskId,
        showAttach: () => setIsAttachOpen(true),
        hideAttach: () => {
            setIsAttachOpen(false)
            setAttachIds([])
        },
        chooseAttach: setAttachIds,
        askDetach: setDetachAskId,
    }
}
