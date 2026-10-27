"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useLeadGenWorkbench } from "@/hooks/leadgen"
import { handoffsViewOf, leadsViewOf, sourcesViewOf } from "@/hooks/leadgenView"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import type { LeadGenWorkbenchData } from "@/modules/types"
import { LeadGenListBase } from "./component"

/** Which list of the workbench the panel draws. */
type LeadGenListKind = "leads" | "sources" | "handoffs"

/** What the page tells the panel. */
interface LeadGenListProps {
    /** The Lead Gen instance the workbench opens for. */
    readonly installationId: string | null
    readonly kind: LeadGenListKind
}

/** The name of each list's tab. */
const TAB_KEYS: Readonly<Record<LeadGenListKind, string>> = {
    leads: "tabLeads",
    sources: "tabSources",
    handoffs: "tabHandoffs",
}

/** The workbench with nothing in it: the list view of it keeps the words and has no rows. */
const EMPTY_WORKBENCH: LeadGenWorkbenchData = {
    metrics: {
        newToday: 0,
        hotWaiting: 0,
        firstReplyP50Min: null,
        firstReplySample: 0,
        conversionWindowDays: 0,
        conversionLeads: 0,
        conversionWon: 0,
    },
    leads: [],
    leadsHidden: 0,
    sources: [],
    comments: [],
    handoffs: [],
}

/** The connected prospects, sources or Sales handoffs of one Lead Gen instance. */
export const LeadGenList = (props: LeadGenListProps) => {
    const t = useTranslations("workbenchLeadGen")
    const format = useFormatter()
    const slotLabels = useSlotLabels()
    const workbench = useLeadGenWorkbench(props.installationId)
    const viewOf = (data: LeadGenWorkbenchData) => {
        if (props.kind === "leads") return leadsViewOf(t, format, data.leads, data.leadsHidden)
        if (props.kind === "sources") return sourcesViewOf(t, data.sources)
        return handoffsViewOf(t, format, data.handoffs)
    }
    return (
        <LeadGenListBase
            props={{
                slot: mapSlot(workbench.slot, viewOf),
                placeholder: viewOf(EMPTY_WORKBENCH),
                labels: slotLabels(t(TAB_KEYS[props.kind])),
            }}
            on={{ retry: workbench.retry }}
        />
    )
}
