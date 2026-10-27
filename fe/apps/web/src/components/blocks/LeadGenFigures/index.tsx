"use client"

import { useTranslations } from "next-intl"
import { leadGenFiguresOf, useLeadGenWorkbench } from "@/hooks/leadgen"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import type { LeadGenMetrics } from "@/modules/types"
import { LeadGenFiguresBase } from "./component"

/** The figures before the workbench is read: the terms stay real, the values are skeleton lines. */
const PENDING_METRICS: LeadGenMetrics = {
    newToday: 0,
    hotWaiting: 0,
    firstReplyP50Min: null,
    firstReplySample: 0,
    conversionWindowDays: 90,
    conversionLeads: 0,
    conversionWon: 0,
}

/** What the page tells the ribbon. */
interface LeadGenFiguresProps {
    /** The Lead Gen instance the workbench opens for. */
    readonly installationId: string | null
}

/** The connected ribbon of the Lead Gen workbench. */
export const LeadGenFigures = (props: LeadGenFiguresProps) => {
    const t = useTranslations("workbenchLeadGen")
    const frame = useTranslations("agentDashboard")
    const slotLabels = useSlotLabels()
    const workbench = useLeadGenWorkbench(props.installationId)
    return (
        <LeadGenFiguresBase
            props={{
                label: frame("ribbonAria"),
                slot: mapSlot(workbench.slot, (data) => leadGenFiguresOf(data.metrics, t)),
                placeholder: leadGenFiguresOf(PENDING_METRICS, t),
                labels: slotLabels(t("loadFailedTitle")),
            }}
            on={{ retry: workbench.retry }}
        />
    )
}
