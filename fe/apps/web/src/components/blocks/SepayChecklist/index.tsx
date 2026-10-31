"use client"

import { useFormatter, useTranslations } from "next-intl"
import { sepayStepsOf, useSepayConnection, useSepayPlaceholder } from "@/hooks/sepayConnection"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import type { SepayConnectionView, SepayStepView } from "@/modules/types"
import { SepayChecklistBase } from "./component"
import type { SepayChecklistStep } from "./component"

const STEPPER_STATES = { done: "complete", active: "current", pending: "upcoming" } as const

/** What the page hands the checklist: the connection of the url. */
type SepayChecklistProps = { readonly connectionId: string }

/** The connected test checklist, derived from the pings and transactions the webhook door saw; wording follows the environment. */
export const SepayChecklist = (props: SepayChecklistProps) => {
    const t = useTranslations("sepayConnection")
    const format = useFormatter()
    const slotLabels = useSlotLabels()
    const placeholder = useSepayPlaceholder()
    const { slot, retry } = useSepayConnection(props.connectionId)
    const titleOf = (step: SepayStepView, connection: SepayConnectionView): string => {
        const key =
            connection.environment === "live" && step.id !== "receive" ? `step_${step.id}_live` : `step_${step.id}`
        return t(key, { account: `${connection.bank} ${connection.accountMasked}` })
    }
    const noteOf = (step: SepayStepView, connection: SepayConnectionView): string => {
        if (step.id === "ping" && connection.environment === "test" && connection.pingSeenAt !== null) {
            return t("pingSeenAt", { time: format.dateTime(new Date(connection.pingSeenAt), { timeStyle: "short" }) })
        }
        if (step.id !== "receive") return ""
        return t(connection.environment === "test" ? "receiveNoteTest" : "receiveNoteLive")
    }
    const stepsOf = (connection: SepayConnectionView): ReadonlyArray<SepayChecklistStep> =>
        sepayStepsOf(connection).map((step) => ({
            id: step.id,
            label: titleOf(step, connection),
            note: noteOf(step, connection),
            state: STEPPER_STATES[step.state],
            isWaiting: step.id === "simulate" && step.state === "active",
        }))
    return (
        <SepayChecklistBase
            props={{
                stepsLabel: t("checklistTitle"),
                waitingText: t("waitingText"),
                waitingLabel: t("waitingLabel"),
                doneLabel: t("stepMarkerDone"),
                slot: mapSlot(slot, stepsOf),
                placeholder: stepsOf(placeholder),
                labels: slotLabels(t("loadFailed")),
            }}
            on={{ retry }}
        />
    )
}
