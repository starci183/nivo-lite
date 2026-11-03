"use client"

import { useFormatter, useTranslations } from "next-intl"
import { mapSlot, slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { brainTabHref } from "@/modules/routes"
import type { BrainGap, KnowledgeListView, KnowledgeRowView } from "@/modules/types"
import { useBrainCommand } from "./useBrainCommand"
import { useBrainRowAction } from "./useBrainRowAction"
import type { useBrainBoard } from "./useBrainBoard"

interface GapOptions {
    readonly answer?: "fact" | "public"
    readonly gaps?: readonly BrainGap[]
}

/** The view `useBrainGaps` returns. */
export interface BrainGapsView {
    list: KnowledgeListView
    dispatch: (rowId: string, actionId: string) => void
    retry: () => void
}

/** Resolves unanswered questions for the queue or public answers, without sharing either region's display status. */
export const useBrainGaps = (board: ReturnType<typeof useBrainBoard>, options: GapOptions = {}): BrainGapsView => {
    const t = useTranslations("brain")
    const pub = useTranslations("publicBrain")
    const format = useFormatter()
    const labels = useSlotLabels()
    const command = useBrainCommand()
    const { pending, dispatch } = useBrainRowAction({
        actionId: "dismiss",
        canWrite: board.canWrite,
        isKnown: (rowId) => (options.gaps ?? board.gaps).some((gap) => gap.id === rowId),
        send: (rowId) => command.send("gap.dismiss", { id: rowId }, { done: t("gapDismissed") }),
    })
    const rowOf = (gap: BrainGap): KnowledgeRowView => {
        const when = format.dateTime(new Date(gap.lastSeenAt), { dateStyle: "medium" })
        return {
            id: gap.id,
            title: gap.question,
            lines: [gap.count > 1 ? t("gapAsked", { n: gap.count, when }) : t("gapAskedOnce", { when })],
            badges: [
                { label: gap.module, tone: "neutral" },
                ...(gap.reopenedCount > 0 ? [{ label: t("gapReopened"), tone: "warning" as const }] : []),
            ],
            actions: board.canWrite
                ? [
                      {
                          id: "answer",
                          label: t("gapAnswer"),
                          href:
                              options.answer === "public"
                                  ? brainTabHref("publicDocs", { compose: "write", title: gap.question })
                                  : brainTabHref("todo", { answer: gap.id }),
                      },
                      {
                          id: "dismiss",
                          label: t("gapDismiss"),
                          intent: "neutral",
                          isPending: pending === gap.id,
                          isDisabled: pending !== undefined && pending !== gap.id,
                          disabledReason: t("actionBusy"),
                      },
                  ]
                : [],
        }
    }
    const list: KnowledgeListView = {
        section: { id: "brain-gaps-title", title: t("gapsTitle"), failTitle: t("loadFailed") },
        label: t("gapsTitle"),
        ...(options.answer === "public" ? { footer: pub("asksFooter") } : {}),
        isPending: command.isPending,
        slot:
            options.gaps === undefined
                ? mapSlot(board.slot, (brain) => brain.gaps.map(rowOf))
                : slotOfSwr({ data: options.gaps.map(rowOf), error: undefined, isLoading: false }),
        slotLabels: labels(t("gapsEmpty")),
    }
    return { list, dispatch, retry: board.reload }
}
