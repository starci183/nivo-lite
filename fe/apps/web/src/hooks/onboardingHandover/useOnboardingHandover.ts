"use client"

import { useInstallations } from "@/hooks/installations"
import { useAgentNodeRights } from "@/hooks/nodeRights"
import { useQueryAuthUserSwr, useQueryWorkspaceMembersSwr } from "@/hooks/swr"
import { useOpenWorkspaceId } from "@/hooks/workspaceKey"

/**
 * How the AI answers a customer today, as the steps that hold the customer send declare it (rights.md: each node declares `auto` or
 * `ask`): some step asks first, every step sends alone, no step sends at all (a fact, not a mode), or unknown while the rights load.
 */
export type OnboardingApproval = "ask" | "auto" | "none" | "unknown"

/** What the handover step shows: who holds new customers and how the AI sends to a customer. */
export interface OnboardingHandoverState {
    /** The person new customers go to first (the workspace owner); undefined while unread. */
    readonly owner: { readonly name: string; readonly isMe: boolean } | undefined
    readonly approval: OnboardingApproval
}

/** The agent that answers customers. */
const REPLY_MODULE = "chatbot"
/** The one tool that writes to a customer, as the be names it in the node-rights rows (data from the be, so the literal id, never `TOOL`). */
const SEND_TOOL = "nivo.tool.customer.message.send"

/** The approval the modes of the steps that hold the send mean: unknown until read, none when no step holds it, ask when any asks. */
const approvalOf = (isRead: boolean, modes: ReadonlyArray<"auto" | "ask">): OnboardingApproval => {
    if (!isRead) return "unknown"
    if (modes.length === 0) return "none"
    return modes.includes("ask") ? "ask" : "auto"
}

/** Reads the workspace owner and the modes of the chatbot's steps that hold the customer send, both live. The mode is edited in each step. */
export const useOnboardingHandover = (): OnboardingHandoverState => {
    const workspaceId = useOpenWorkspaceId()
    const user = useQueryAuthUserSwr()
    const members = useQueryWorkspaceMembersSwr(workspaceId)
    const { installations } = useInstallations()
    const chatbot = installations?.find((entry) => entry.moduleKey === REPLY_MODULE && entry.agentId !== null)
    const nodeRights = useAgentNodeRights(chatbot?.agentId ?? null)
    const sendRows = "items" in nodeRights.slot ? nodeRights.slot.items.rows.filter((row) => row.operation.id === SEND_TOOL) : []
    const approval = approvalOf("items" in nodeRights.slot, sendRows.map((row) => row.mode))
    const ownerMember = members.data?.find((row) => row.role === "owner")
    return {
        owner:
            ownerMember === undefined
                ? undefined
                : {
                      name: ownerMember.displayName === "" ? ownerMember.email : ownerMember.displayName,
                      isMe: user.data?.id === ownerMember.userId,
                  },
        approval,
    }
}
