"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { adviceFor, reviewRowsOf, type ReviewRowsContext } from "@/modules/brain"
import { toast } from "@/modules/toast"
import type { KnowledgeListView } from "@/modules/types"
import { useBrainCommand } from "./useBrainCommand"
import type { useBrainBoard } from "./useBrainBoard"

/** The view `useBrainReview` returns. */
export interface BrainReviewView {
    list: KnowledgeListView
    dispatch: (rowId: string, actionId: string, partId?: string) => void
    retry: () => void
}

/** Owns fact review decisions and the independently retryable facts region of the queue. */
export const useBrainReview = (board: ReturnType<typeof useBrainBoard>): BrainReviewView => {
    const t = useTranslations("brain")
    const feedback = useTranslations("toast")
    const command = useBrainCommand()
    const labels = useSlotLabels()
    const [pending, setPending] = useState<string | undefined>()
    const failed = () => {
        toast.danger(feedback("errorTitle"), { description: feedback("defaultError") })
    }
    const context: ReviewRowsContext = { t, canWrite: board.canWrite, nowMs: board.nowMs, pending }
    const { plan } = reviewRowsOf(board.facts, context)
    const ready = plan.singles.filter((single) => adviceFor(single.p, single.current, board.nowMs).action === "apply")
    const decide = async (rowId: string, actionId: string, partId?: string) => {
        if (!board.canWrite || pending !== undefined) return
        setPending(`${partId ?? rowId}:${actionId}`)
        try {
            if (actionId === "apply-all") {
                const outcomes = await Promise.all(
                    ready.map((single) => command.send("fact.decide", { id: single.p.id, action: "apply" })),
                )
                const count = outcomes.filter((outcome) => outcome !== undefined).length
                if (count > 0) toast.success(t("appliedMany", { count }))
                return
            }
            const group = plan.groups.find((one) => one.key === rowId)
            const first = group?.options[0]
            if (actionId === "keep" && first !== undefined)
                return await command.send(
                    "fact.keep",
                    { subjectKey: first.subjectKey, attribute: first.attribute },
                    { done: t("retireKept") },
                )
            const factId = partId ?? rowId
            if (!board.facts.some((fact) => fact.id === factId)) return
            if (actionId === "apply" || actionId === "choose" || actionId === "reject")
                return await command.send(
                    "fact.decide",
                    { id: factId, action: actionId },
                    { done: t(actionId === "reject" ? "rejected" : "applied") },
                )
            return undefined
        } catch {
            failed()
            return undefined
        } finally {
            setPending(undefined)
        }
    }
    const dispatch = (rowId: string, actionId: string, partId?: string) => {
        decide(rowId, actionId, partId).catch(failed)
    }
    const list: KnowledgeListView = {
        section: {
            id: "brain-review-title",
            title: t("waitingFactsTitle"),
            failTitle: t("loadFailed"),
            action:
                board.canWrite && ready.length > 1
                    ? {
                          id: "apply-all",
                          label: t("applyAll", { count: ready.length }),
                          intent: "commit",
                          isPending: pending === ":apply-all",
                          isDisabled: pending !== undefined && pending !== ":apply-all",
                          disabledReason: t("actionBusy"),
                      }
                    : undefined,
        },
        label: t("waitingFactsTitle"),
        footer: t("waitingFactsFooter"),
        isPending: command.isPending,
        slot: mapSlot(board.slot, (brain) => reviewRowsOf(brain.facts, context).rows),
        slotLabels: labels(t("waitingFactsEmpty")),
    }
    return { list, dispatch, retry: board.reload }
}
