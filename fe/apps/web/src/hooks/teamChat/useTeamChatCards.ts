"use client"

import { useState } from "react"
import { useMutateDecideChatApprovalSwr, useMutatePinChatMessageSwr, useMutateUnpinChatMessageSwr } from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import type { TeamChatVerdict } from "@/modules/types"

/** The decision being answered and why the last answer did not settle one. */
interface DecidingState {
    readonly id: string | null
    /** The refusal code of the door, or "failed" for a transport failure; null when the last answer settled. */
    readonly refusal: string | null
}

/** The view `useTeamChatCards` returns. */
export interface TeamChatCardsView {
    readonly decidingId: string | null
    readonly decideRefusal: string | null
    readonly togglePin: (messageId: string, isPinned: boolean) => Promise<void>
    readonly decide: (decisionId: string, verdict: TeamChatVerdict) => Promise<void>
}

/**
 * What is done with the messages of the open room: pin or unpin one, and answer an approval card. The answer goes to the one decide
 * door; the door proves the right again, so a card that offered a button may still be refused. `onChanged` reads the thread again.
 */
export const useTeamChatCards = (roomId: string | null, onChanged: () => void): TeamChatCardsView => {
    const workspaceId = useWorkspaceId() ?? ""
    const pin = useMutatePinChatMessageSwr(workspaceId)
    const unpin = useMutateUnpinChatMessageSwr(workspaceId)
    const decideApproval = useMutateDecideChatApprovalSwr(workspaceId)
    const [deciding, setDeciding] = useState<DecidingState>({ id: null, refusal: null })
    return {
        decidingId: deciding.id,
        decideRefusal: deciding.refusal,
        togglePin: async (messageId, isPinned) => {
            if (roomId === null) return
            if (isPinned) await unpin.trigger({ roomId, messageId })
            else await pin.trigger({ roomId, messageId })
            onChanged()
        },
        decide: async (decisionId, verdict) => {
            setDeciding({ id: decisionId, refusal: null })
            try {
                const answer = await decideApproval.trigger({
                    decisionId,
                    verdict: verdict === "approved" ? "approve" : "reject",
                })
                setDeciding({ id: null, refusal: answer === undefined ? "failed" : answer.refusal })
            } catch {
                setDeciding({ id: null, refusal: "failed" })
            }
            onChanged()
        },
    }
}
