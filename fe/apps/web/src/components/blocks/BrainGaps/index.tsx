"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useBrainBoard, useBrainCommand } from "@/hooks/brain"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { brainTabHref } from "@/modules/routes"
import type { KnowledgeRowView } from "@/components/composites/KnowledgeRows"
import type { BrainGap } from "@/modules/types"
import { BrainGapsBase } from "./component"

/** Props for the connected unanswered questions. */
interface BrainGapsProps {
    /** The questions a page already holds (the chatbot workbench); without it the block reads the Second Brain itself. */
    readonly gaps?: ReadonlyArray<BrainGap>
}

/** The connected unanswered questions: opens the fact form through the address, or dismisses a question. */
export const BrainGaps = (props: BrainGapsProps) => {
    const t = useTranslations("brain")
    const format = useFormatter()
    const command = useBrainCommand()
    const board = useBrainBoard()
    const slotLabels = useSlotLabels()
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
            actions: [
                { id: "answer", label: t("gapAnswer"), href: brainTabHref("gaps", { answer: gap.id }) },
                {
                    id: "dismiss",
                    label: t("gapDismiss"),
                    intent: "neutral",
                    onPress: () => command.send("gap.dismiss", { id: gap.id }, { done: t("gapDismissed") }),
                },
            ],
        }
    }
    if (props.gaps === undefined && !board.canWrite) return null
    return (
        <BrainGapsBase
            props={{
                list: {
                    section: {
                        id: "brain-gaps-title",
                        title: t("gapsTitle"),
                        description: t("gapsIntro"),
                        failTitle: t("loadFailed"),
                    },
                    label: t("gapsTitle"),
                    isPending: command.isPending,
                    slot:
                        props.gaps === undefined
                            ? mapSlot(board.slot, (brain) => brain.gaps.map(rowOf))
                            : { items: props.gaps.map(rowOf) },
                    slotLabels: slotLabels(t("gapsEmpty")),
                },
            }}
            on={{ retry: board.reload }}
        />
    )
}
