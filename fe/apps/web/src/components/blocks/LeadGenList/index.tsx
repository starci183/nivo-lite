"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useLeadGenWorkbench } from "@/hooks/leadgen"
import { handoffsViewOf, leadsViewOf, sourcesViewOf } from "@/hooks/leadgenView"
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

/** The connected prospects, sources or Sales handoffs of one Lead Gen instance. */
export const LeadGenList = (props: LeadGenListProps) => {
    const t = useTranslations("workbenchLeadGen")
    const format = useFormatter()
    const workbench = useLeadGenWorkbench(props.installationId)
    const viewOf = (data: LeadGenWorkbenchData) => {
        if (props.kind === "leads") return leadsViewOf(t, format, data.leads, data.leadsHidden)
        if (props.kind === "sources") return sourcesViewOf(t, data.sources)
        return handoffsViewOf(t, format, data.handoffs)
    }
    return (
        <LeadGenListBase
            props={{
                list: workbench.data === undefined ? null : viewOf(workbench.data),
                pending: { label: t(TAB_KEYS[props.kind]), failure: workbench.failure, onRetry: workbench.retry },
            }}
        />
    )
}
