import { KnowledgeRowList, KnowledgeRowsSection, rowListPropsOf } from "@/components/composites/KnowledgeRows"
import type { KnowledgeListView } from "@/components/composites/KnowledgeRows"

/** The list the connected review supplies. */
export interface BrainReviewBaseProps {
    readonly props: { readonly list: KnowledgeListView }
}

/**
 * Draws the facts that agents, staff and customers proposed and no agent uses yet: conflicts side by side, each with its
 * decision. The queue draws it only once the brain is read and something waits, so it has no loading or empty status of its own.
 */
export const BrainReviewBase = (props: BrainReviewBaseProps) => {
    const list = props.props.list
    return (
        <KnowledgeRowsSection isHeadingInCard section={list.section} isPending={list.isPending}>
            <KnowledgeRowList {...rowListPropsOf(list)} rows={list.slot.items ?? []} />
        </KnowledgeRowsSection>
    )
}
