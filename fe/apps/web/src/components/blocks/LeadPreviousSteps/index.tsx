"use client"

import { useTranslations } from "next-intl"
import { splitResponsibilities, STATUS_KEYS, useLeadJourney } from "@/hooks/leads"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import type { LeadJourney, DataSlot } from "@/modules/types"
import { LeadPreviousStepsBase } from "./component"
import type { PreviousStepView } from "./component"

/** The lead whose earlier steps are listed; null while it loads. */
interface LeadPreviousStepsProps {
    readonly leadId?: string
}

/** The earlier steps of a lead: the words are settled here, the drawing is the pure half. */
export const LeadPreviousSteps = (props: LeadPreviousStepsProps) => {
    const query = useLeadJourney(props.leadId)
    const t = useTranslations("lead")
    const slotLabels = useSlotLabels()
    const stepsOf = (detail: LeadJourney): ReadonlyArray<PreviousStepView> =>
        splitResponsibilities(detail.responsibilities).previous.map((step) => ({
            id: step.id,
            title: step.title,
            description: `${step.owner_name} · ${t(STATUS_KEYS[step.status])}`,
        }))
    const slot: DataSlot<ReadonlyArray<PreviousStepView>> = mapSlot(query.slot, stepsOf)
    return <LeadPreviousStepsBase props={{ slot, title: t("previousSteps"), labels: slotLabels(t("previousSteps")) }} />
}
