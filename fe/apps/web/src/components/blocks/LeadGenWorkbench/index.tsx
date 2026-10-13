"use client"

import { useLeadGenComments, useLeadGenWorkbench } from "@/hooks/leadgen"
import { LeadGenWorkbenchBase } from "./component"

/** Route identity and initial tab; all data is read by browser hooks. */
interface LeadGenWorkbenchProps {
    readonly tab?: string | null
    readonly focus?: string | null
    readonly installationId?: string | null
    readonly scopeInstallationId?: string | null
}

/** Connects the Lead Gen frame to the API and keeps retry and loading states local to the block. */
export const LeadGenWorkbench = (props: LeadGenWorkbenchProps) => {
    const workbench = useLeadGenWorkbench(props)
    const comments = useLeadGenComments(workbench.comments)
    return (
        <LeadGenWorkbenchBase
            key={workbench.scopeKey}
            props={{
                dashboard: workbench.dashboard,
                figures: workbench.figures,
                leads: workbench.leads,
                sources: workbench.sources,
                comments: workbench.hasData ? comments.props : null,
                handoffs: workbench.handoffs,
                initialTab: workbench.initialTab,
                isLoading: workbench.isLoading,
                failed: workbench.failed,
                figuresFailed: workbench.figuresFailed,
                labels: { ...workbench.labels, comments: workbench.commentsTabLabel },
            }}
            on={{
                retry: workbench.retry,
                commentEdit: comments.on.edit,
                commentCancel: comments.on.cancel,
                commentDraft: comments.on.draft,
                commentApprove: comments.on.approve,
                commentRetry: comments.on.retry,
            }}
        />
    )
}
