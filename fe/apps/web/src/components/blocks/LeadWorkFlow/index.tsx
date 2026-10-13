"use client"

import { useTranslations } from "next-intl"
import { useLeadFlowView, type FlowView } from "@/hooks/leads"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import type { LeadFlow } from "@/lib/flow-types"
import { navigation } from "@/modules/i18n"
import { LeadWorkFlowBase } from "./component"
import type { DataSlot } from "@/modules/types"

/** The work flow of the lead as the page read it: loading, failed or the flow itself. */
interface LeadWorkFlowProps {
    readonly flow: DataSlot<LeadFlow>
}

/** The work flow card: words and formats the page's flow into the view the pure half draws. */
export const LeadWorkFlow = (props: LeadWorkFlowProps) => {
    const t = useTranslations("lead")
    const g = useTranslations("governance")
    const slotLabels = useSlotLabels()
    const router = navigation.useRouter()
    const viewOf = useLeadFlowView()
    const slot: DataSlot<FlowView> = mapSlot(props.flow, viewOf)
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
            on={{ retry: () => router.refresh() }}
        />
    )
}
