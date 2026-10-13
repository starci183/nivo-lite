"use client"

import { useTranslations } from "next-intl"
import { useLeadFlow, useLeadFlowView, type FlowView } from "@/hooks/leads"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { LeadWorkFlowBase } from "./component"
import type { DataSlot } from "@/modules/types"

/** The work flow of the lead as the page read it: loading, failed or the flow itself. */
interface LeadWorkFlowProps {
    readonly leadId?: string
}

/** The work flow card: words and formats the page's flow into the view the pure half draws. */
export const LeadWorkFlow = (props: LeadWorkFlowProps) => {
    const t = useTranslations("lead")
    const g = useTranslations("governance")
    const slotLabels = useSlotLabels()
    const query = useLeadFlow(props.leadId)
    const viewOf = useLeadFlowView()
    const slot: DataSlot<FlowView> = mapSlot(
        {
            isLoading: props.leadId === undefined || query.isLoading,
            isError: query.error !== undefined,
            items: query.data,
        },
        viewOf,
    )
    return (
        <LeadWorkFlowBase
            props={{
                slot,
                labels: {
                    title: t("flowTitle"),
                    stepsTitle: t("flowSteps"),
                    stepsEmptyTitle: t("flowNoSteps"),
                    stepsEmptyHint: t("flowNoStepsHint"),
                    simulatedBadge: g("origin_simulated"),
                    simulatedNote: t("flowSimulatedNote"),
                    slot: slotLabels(t("flowUnavailable")),
                },
            }}
            on={{
                retry: () => {
                    void query.mutate()
                },
            }}
        />
    )
}
