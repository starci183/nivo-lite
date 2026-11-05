"use client"

import { useFormatter, useTranslations } from "next-intl"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import type { DataSlot, SepayConnectionView, SepayStepView, SlotLabels } from "@/modules/types"
import { sepayStepsOf } from "./sepayConnection.shared"
import { useSepayConnection } from "./useSepayConnection"
import { useSepayPlaceholder } from "./useSepayPlaceholder"

const STEPPER_STATES = { done: "complete", active: "current", pending: "upcoming" } as const

/** One step of the test checklist as it is worded. */
interface ChecklistStep {
    readonly id: string
    readonly label: string
    readonly note: string
    readonly state: "complete" | "current" | "upcoming"
    readonly isWaiting: boolean
}

/** What the test checklist of a SePay connection draws. */
interface SepayChecklistView {
    readonly stepsLabel: string
    readonly waitingText: string
    readonly doneLabel: string
    readonly slot: DataSlot<ReadonlyArray<ChecklistStep>>
    readonly placeholder: ReadonlyArray<ChecklistStep>
    readonly labels: SlotLabels
}

/** The test checklist, derived from the pings and transactions the webhook door saw; the wording follows the environment. */
export const useSepayChecklistView = (connectionId: string): SepayChecklistView => {
    const t = useTranslations("sepayConnection")
    const format = useFormatter()
    const slotLabels = useSlotLabels()
    const { slot } = useSepayConnection(connectionId)
    const placeholder = useSepayPlaceholder()
    const titleOf = (step: SepayStepView, view: SepayConnectionView): string => {
        const key = view.environment === "live" && step.id !== "receive" ? `step_${step.id}_live` : `step_${step.id}`
        return t(key, { account: `${view.bank} ${view.accountMasked}` })
    }
    const noteOf = (step: SepayStepView, view: SepayConnectionView): string => {
        if (step.id === "ping" && view.environment === "test" && view.pingSeenAt !== null) {
            return t("pingSeenAt", { time: format.dateTime(new Date(view.pingSeenAt), { timeStyle: "short" }) })
        }
        if (step.id !== "receive") return ""
        return t(view.environment === "test" ? "receiveNoteTest" : "receiveNoteLive")
    }
    const stepsOf = (view: SepayConnectionView): ReadonlyArray<ChecklistStep> =>
        sepayStepsOf(view).map((step) => ({
            id: step.id,
            label: titleOf(step, view),
            note: noteOf(step, view),
            state: STEPPER_STATES[step.state],
            isWaiting: step.id === "simulate" && step.state === "active",
        }))
    return {
        stepsLabel: t("checklistTitle"),
        waitingText: t("waitingText"),
        doneLabel: t("stepMarkerDone"),
        slot: mapSlot(slot, stepsOf),
        placeholder: stepsOf(placeholder),
        labels: slotLabels(t("loadFailed")),
    }
}
