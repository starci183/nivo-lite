"use client"

import { useTranslations } from "next-intl"
import { useLeadGenComments, useLeadGenWorkbench } from "@/hooks/leadgen"
import { LeadGenCommentsBase } from "./component"

/** What the page tells the panel. */
interface LeadGenCommentsProps {
    /** The Lead Gen instance the workbench opens for. */
    readonly installationId: string | null
}

/** The connected comments tab of one Lead Gen instance: the drafted public replies, their editor and the approval job. */
export const LeadGenComments = (props: LeadGenCommentsProps) => {
    const t = useTranslations("workbenchLeadGen")
    const workbench = useLeadGenWorkbench(props.installationId)
    const comments = useLeadGenComments(workbench.data?.comments ?? [])
    return (
        <LeadGenCommentsBase
            props={{
                comments: workbench.data === undefined ? null : comments.props,
                pending: { label: t("tabComments"), failure: workbench.failure, onRetry: workbench.retry },
            }}
            on={comments.on}
        />
    )
}
