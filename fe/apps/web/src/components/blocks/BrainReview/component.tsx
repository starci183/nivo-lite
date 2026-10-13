import { KnowledgeRows } from "@/components/composites/KnowledgeRows"
import type { KnowledgeRowsProps } from "@/components/composites/KnowledgeRows"

/** The list the connected review supplies. */
export interface BrainReviewBaseProps {
    readonly props: { readonly list: KnowledgeRowsProps }
}

/** Draws what agents, staff and customers proposed and no agent uses yet: conflicts side by side, each with its decision. */
export const BrainReviewBase = (props: BrainReviewBaseProps) => <KnowledgeRows {...props.props.list} />
