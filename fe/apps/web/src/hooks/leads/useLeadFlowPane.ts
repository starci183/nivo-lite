"use client"

import { useTranslations } from "next-intl"
import { loadingSlot, mapSlot, slotOfSwr, useSlotLabels } from "@/hooks/slot"
import type { DataSlot, FlowView, LeadFlowPane } from "@/modules/types"
import { useLeadFlow } from "./useLeadFlow"
import { useLeadFlowView } from "./useLeadFlowView"

/** The orders-and-payments region of the aside and its retry. */
export interface LeadFlowPaneView {
    readonly pane: LeadFlowPane
    readonly on: { readonly retry: () => void }
}

/** The AI work steps, orders, invoices, payments and decisions of one lead, worded for the aside. */
export const useLeadFlowPane = (leadId: string | undefined): LeadFlowPaneView => {
    const t = useTranslations("lead")
    const slotLabels = useSlotLabels()
    const query = useLeadFlow(leadId)
    const viewOf = useLeadFlowView()
    const slot: DataSlot<FlowView> = leadId === undefined ? loadingSlot<FlowView>() : mapSlot(slotOfSwr(query), viewOf)
    return {
        pane: {
            slot,
            labels: { title: t("flowTitle"), stepsTitle: t("flowSteps"), slot: slotLabels(t("flowUnavailable")) },
        },
        on: {
            retry: () => {
                void query.mutate()
            },
        },
    }
}
