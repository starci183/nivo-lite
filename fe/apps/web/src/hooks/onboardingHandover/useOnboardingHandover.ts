"use client"

import { useAuthoritySection, useSaveAuthorityRules } from "@/hooks/authority"
import { useQueryAuthUserSwr, useQueryWorkspaceMembersSwr } from "@/hooks/swr"
import type { StoredRule } from "@/modules/authority"
import { useActiveWorkspace } from "@/hooks/workspaces"

/** How the workspace answers a customer today: asks first, sends alone, or may not send; unknown while the rules load. */
export type OnboardingApproval = "ask" | "auto" | "never" | "unknown"

/** What the handover step shows: who holds new customers, whether the AI asks before it sends, and the way to change that. */
export interface OnboardingHandoverState {
    /** The person new customers go to first (the workspace owner); undefined while unread. */
    readonly owner: { readonly name: string; readonly isMe: boolean } | undefined
    readonly approval: OnboardingApproval
    /** True when only an owner or manager may change the approval. */
    readonly isLocked: boolean
    readonly isSaving: boolean
    /** Turns the approval on (the AI asks first) or off (the AI sends alone). */
    readonly setApproval: (on: boolean) => void
}

/** The approval a stored rule means: no rule is the same as never (nothing without a rule runs), unknown until the rules load. */
const approvalOf = (isRead: boolean, mode: StoredRule["mode"] | undefined): OnboardingApproval => {
    if (!isRead) return "unknown"
    return mode === undefined ? "never" : mode
}

/** The authority rule that gates the AI replying to a customer. */
const REPLY_DEPARTMENT = "chatbot"
const REPLY_ACTION = "reply_customer"

/** Reads the real settings the handover step shows: the workspace owner and the `chatbot/reply_customer` rule, and writes that rule's mode. */
export const useOnboardingHandover = (): OnboardingHandoverState => {
    const { activeWorkspaceId } = useActiveWorkspace()
    const user = useQueryAuthUserSwr()
    const members = useQueryWorkspaceMembersSwr(activeWorkspaceId)
    const { slot, rules, isLocked } = useAuthoritySection()
    const { save, isSaving } = useSaveAuthorityRules()
    const ownerMember = members.data?.find((row) => row.role === "owner")
    const rule = rules.find((row) => row.department === REPLY_DEPARTMENT && row.action === REPLY_ACTION)
    const approval = approvalOf(slot.items !== undefined, rule?.mode)
    return {
        owner:
            ownerMember === undefined
                ? undefined
                : {
                      name: ownerMember.displayName === "" ? ownerMember.email : ownerMember.displayName,
                      isMe: user.data?.id === ownerMember.userId,
                  },
        approval,
        isLocked: isLocked || approval === "unknown" || approval === "never",
        isSaving,
        setApproval: (on) => {
            if (rule === undefined) return
            void save([
                {
                    department: REPLY_DEPARTMENT,
                    action: REPLY_ACTION,
                    mode: on ? "ask" : "auto",
                    limit: rule.limit,
                    required: rule.required,
                },
            ])
        },
    }
}
