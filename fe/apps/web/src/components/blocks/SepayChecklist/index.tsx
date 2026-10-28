"use client"

import { useFormatter, useTranslations } from "next-intl"
import { sepayStepsOf, useSepayConnection, useSepayPlaceholder } from "@/hooks/sepayConnection"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import type { SepayConnectionView, SepayStepView } from "@/modules/types"
import { SepayChecklistBase } from "./component"
import type { SepayChecklistStep } from "./component"

/** What the page hands the checklist: the connection of the url. */
type SepayChecklistProps = { readonly connectionId: string }

/** The connected test checklist, derived from the pings and transactions the webhook door saw. */
export const SepayChecklist = (props: SepayChecklistProps) => {
    const t = useTranslations("sepayConnection")
    const format = useFormatter()
    const slotLabels = useSlotLabels()
    const placeholder = useSepayPlaceholder()
    const { slot, retry } = useSepayConnection(props.connectionId)
    const noteOf = (step: SepayStepView, connection: SepayConnectionView): string => {
        if (step.id === "ping" && connection.pingSeenAt !== null) {
            return t("pingSeenAt", { time: format.dateTime(new Date(connection.pingSeenAt), { timeStyle: "short" }) })
        }
        if (step.id !== "receive") return ""
        return t(connection.environment === "test" ? "receiveNoteTest" : "receiveNoteLive")
    }
    const stepsOf = (connection: SepayConnectionView): ReadonlyArray<SepayChecklistStep> =>
        sepayStepsOf(connection).map((step) => ({
            id: step.id,
            title: t(`step_${step.id}`, { account: `${connection.bank} ${connection.accountMasked}` }),
            note: noteOf(step, connection),
            state: step.state,
            stateLabel: t(`stepState_${step.state}`),
        }))
    return (
        <SepayChecklistBase
            props={{
                title: t("checklistTitle"),
                slot: mapSlot(slot, stepsOf),
                placeholder: stepsOf(placeholder),
                labels: slotLabels(t("loadFailed")),
            }}
            on={{ retry }}
        />
    )
}
