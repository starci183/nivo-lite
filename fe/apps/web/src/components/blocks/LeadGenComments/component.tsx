import { LeadGenCommentList } from "@/components/composites/LeadGenCommentList"
import type { LeadGenCommentListData } from "@/components/composites/LeadGenCommentList"
import { SlotView } from "@/components/composites/SlotView"
import type { SlotPanelProps } from "@/modules/types"

/** Props for {@link LeadGenCommentsBase}. */
export interface LeadGenCommentsBaseProps {
    /** The placeholder is the tab with no rows: its words stay real while the rows draw as skeleton. */
    readonly props: SlotPanelProps<LeadGenCommentListData>
    readonly on: {
        readonly edit: (id: string) => void
        readonly cancel: (id: string) => void
        readonly draft: (id: string, value: string) => void
        readonly approve: (id: string, edited: boolean) => void
        /** Retries the approval status read of a row. */
        readonly retry: () => void
        /** Reads the whole panel again after it failed. */
        readonly reload: () => void
    }
}

/** Draws the public comments waiting for a person; the status of the read goes through SlotView. */
export const LeadGenCommentsBase = (props: LeadGenCommentsBaseProps) => {
    const { props: p, on } = props
    return (
        <SlotView slot={p.slot} placeholder={p.placeholder} labels={p.labels} onRetry={on.reload}>
            {(comments, isSkeleton) => (
                <LeadGenCommentList
                    {...comments}
                    isSkeleton={isSkeleton}
                    onEdit={on.edit}
                    onCancel={on.cancel}
                    onDraft={on.draft}
                    onApprove={on.approve}
                    onRetry={on.retry}
                />
            )}
        </SlotView>
    )
}
