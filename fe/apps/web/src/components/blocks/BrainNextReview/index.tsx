"use client"

import { useTranslations } from "next-intl"
import { useWaitingFactCount } from "@/hooks/brain"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { brainTabHref } from "@/modules/routes"
import type { DataSlot } from "@/modules/types"
import { BrainNextReviewBase } from "./component"

/** The line to show: a settled count of zero is an empty slot, so nothing is drawn while none waits. */
const nextReviewSlotOf = (slot: DataSlot<number>, line: (count: number) => string): DataSlot<string> => {
    if ("items" in slot && slot.items === 0) return { isEmpty: true }
    return mapSlot(slot, line)
}

/** After documents came in: the facts that wait for review, linked to the queue where they are decided. Nothing is drawn while none waits. */
export const BrainNextReview = () => {
    const t = useTranslations("secondBrain")
    const labels = useSlotLabels()
    const waiting = useWaitingFactCount()
    return (
        <BrainNextReviewBase
            props={{
                slot: nextReviewSlotOf(waiting.slot, (count) => t("nextReview", { count })),
                labels: labels(""),
                href: brainTabHref("todo"),
            }}
            on={{ retry: waiting.reload }}
        />
    )
}
