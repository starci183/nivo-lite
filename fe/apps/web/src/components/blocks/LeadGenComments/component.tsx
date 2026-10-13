import { LeadGenCommentList } from "@/components/composites/LeadGenCommentList"
import type { LeadGenCommentListData } from "@/components/composites/LeadGenCommentList"
import { PanelPending } from "@/components/composites/PanelPending"
import type { PanelPendingProps } from "@/components/composites/PanelPending"

/** Props for {@link LeadGenCommentsBase}. */
export interface LeadGenCommentsBaseProps {
    readonly props: {
        /** The comments once the workbench is read; null while it is not. */
        readonly comments: LeadGenCommentListData | null
        readonly pending: PanelPendingProps
    }
    readonly on: {
        readonly edit: (id: string) => void
        readonly cancel: (id: string) => void
        readonly draft: (id: string, value: string) => void
        readonly approve: (id: string, edited: boolean) => void
        readonly retry: () => void
    }
}

/** Draws the public comments waiting for a person, or the skeleton or failure of the panel while it is not read. */
export const LeadGenCommentsBase = (props: LeadGenCommentsBaseProps) =>
    props.props.comments === null ? (
        <PanelPending {...props.props.pending} />
    ) : (
        <LeadGenCommentList
            {...props.props.comments}
            onEdit={props.on.edit}
            onCancel={props.on.cancel}
            onDraft={props.on.draft}
            onApprove={props.on.approve}
            onRetry={props.on.retry}
        />
    )
