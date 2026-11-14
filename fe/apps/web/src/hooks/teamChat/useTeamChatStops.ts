"use client"

import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { useMember } from "@/hooks/member"
import { useMutateDecideRunStopSwr, useMutateReleaseConversationSwr, useMutateRunFlowSwr } from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import { isRefusedByBackend } from "@/modules/failure"
import { toast } from "@/modules/toast"
import type { TeamChatStopAction, TeamChatStopCardView } from "@/modules/types"
import { approvalCardIdOf } from "./teamChat.view"

/** The view `useTeamChatStops` returns. */
export interface TeamChatStopsView {
    /** The viewer is the workspace owner: only the owner may approve a leave request. */
    readonly isOwner: boolean
    /** The card whose action is in flight (`runId:stepKey`), or null. */
    readonly pendingKey: string | null
    readonly act: (card: TeamChatStopCardView, action: TeamChatStopAction) => Promise<void>
}

/** The decide door's outcomes that mean the stop is closed by this action; the others say the engine is applying one already. */
const CLOSED_OUTCOME = "stop_closed"

/** The decide door refused a press on a stop that waits for the owner's verdict on a permission request: nothing moved. */
const APPROVAL_PENDING = "approval_pending"

/** Brings the card of a leave request into view; nothing when it is not in the open room. */
const focusApprovalCard = (workItemId: string | null): void => {
    if (workItemId === null) return
    document.getElementById(approvalCardIdOf(workItemId))?.scrollIntoView({ block: "center", behavior: "smooth" })
}

/** The hand-back door's outcomes: the route was cleared (or someone woke), or nobody held it (not an error: nothing to do). */
const RELEASED_OUTCOME = "released"
const NOTHING_HELD_OUTCOME = "nothing_held"

/** The decide door's name for each decision of the card. */
const ACTION_OF = { retry: "retry", take_over: "take_over", skip: "skip" } as const

/**
 * What is done with the stop cards of the open room. Hand back goes to `releaseConversation` (both of its outcomes `released` and `nothing_held` are quiet notices, never an error). Answer, retry, take over and skip go to the run's decide door (`decideRunStop`);
 * a leave request is answered through its WORK ITEM, the work items' own decision door (`runFlow` kind `decide`), never the decide door. The
 * door proves the right again (a manager's approval is refused there). After any action `onChanged` reads the thread again, so the
 * card the engine rewrote in place is drawn anew.
 */
export const useTeamChatStops = (onChanged: () => void): TeamChatStopsView => {
    const t = useTranslations("teamChat")
    const locale = useLocale()
    const workspaceId = useWorkspaceId() ?? ""
    const member = useMember()
    const decide = useMutateDecideRunStopSwr(workspaceId)
    const flow = useMutateRunFlowSwr(workspaceId)
    const release = useMutateReleaseConversationSwr(workspaceId)
    const [pendingKey, setPendingKey] = useState<string | null>(null)
    const failed = (error: unknown): void => {
        const description = isRefusedByBackend(error) && error instanceof Error ? error.message : t("stopCard.failedText")
        toast.danger(t("stopCard.failedTitle"), { description })
    }
    const run = async (card: TeamChatStopCardView, action: TeamChatStopAction): Promise<void> => {
        if (action.kind === "verdict") {
            if (card.approval === null) return
            await flow.trigger({
                kind: "decide",
                payload: {
                    workItemId: card.approval.workItemId,
                    decision: action.verdict === "approve" ? "approved" : "rejected",
                    locale,
                },
            })
            toast.success(t("stopCard.toastDone"))
            return
        }
        if (action.kind === "hand_back") {
            const released = await release.trigger({ conversationId: action.conversationId })
            if (released.outcome === RELEASED_OUTCOME) toast.success(t("stopCard.handBackDone"))
            else if (released.outcome === NOTHING_HELD_OUTCOME) toast.info(t("stopCard.handBackNothing"))
            else throw new Error(`releaseConversation answered ${released.outcome}`)
            return
        }
        const answer = await decide.trigger({
            runId: card.runId,
            stepKey: card.stepKey,
            ...(action.kind === "answer"
                ? { action: "answer", text: action.text }
                : { action: ACTION_OF[action.decision] }),
        })
        if (answer.outcome === APPROVAL_PENDING) {
            // Not an error and nothing happened: say where the request is answered (its own card) and bring that card into view.
            toast.info(t("stopCard.approvalPending", { approve: card.labels.approve, refuse: card.labels.refuse }))
            focusApprovalCard(answer.refusal?.workItemId ?? card.approval?.workItemId ?? null)
            return
        }
        if (answer.outcome === CLOSED_OUTCOME) toast.success(t("stopCard.toastDone"))
        else toast.info(t("stopCard.toastApplying"))
    }
    return {
        isOwner: member === null || member.role === "owner",
        pendingKey,
        act: async (card, action) => {
            setPendingKey(card.key)
            try {
                await run(card, action)
            } catch (error) {
                failed(error)
            }
            setPendingKey(null)
            onChanged()
        },
    }
}
