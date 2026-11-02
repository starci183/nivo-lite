"use client"

import { useLeadGenWorkbenchView } from "@/hooks/leadgen"
import { LeadGenWorkbenchBase } from "./component"

/** Route atoms and resolved tab copy of one Lead Gen workbench. */
type LeadGenWorkbenchProps = Parameters<typeof useLeadGenWorkbenchView>[0]

/** The sole connected owner of the Lead Gen workbench's dashboard, module read and comment commands. */
export const LeadGenWorkbench = (props: LeadGenWorkbenchProps) => {
    const view = useLeadGenWorkbenchView(props)
    return <LeadGenWorkbenchBase {...view} />
}
