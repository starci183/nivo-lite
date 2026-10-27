import {
    KNOWLEDGE_ROWS_PLACEHOLDER,
    KnowledgeRowList,
    KnowledgeRowsSection,
} from "@/components/composites/KnowledgeRows"
import type { KnowledgeListView } from "@/components/composites/KnowledgeRows"
import { SlotView } from "@/components/composites/SlotView"

/** The list the connected the questions customers asked that the brain could not answer supplies. */
export interface BrainGapsBaseProps {
    readonly props: { readonly list: KnowledgeListView }
    readonly on: { readonly retry: () => void }
}

/** Draws the questions customers asked that the brain could not answer. */
export const BrainGapsBase = (props: BrainGapsBaseProps) => {
    const list = props.props.list
    return (
        <KnowledgeRowsSection section={list.section} isPending={list.isPending}>
            <SlotView
                slot={list.slot}
                placeholder={KNOWLEDGE_ROWS_PLACEHOLDER}
                labels={list.slotLabels}
                onRetry={props.on.retry}
            >
                {(rows, isSkeleton) => (
                    <KnowledgeRowList
                        label={list.label}
                        rows={rows}
                        isPending={list.isPending}
                        isSkeleton={isSkeleton}
                    />
                )}
            </SlotView>
        </KnowledgeRowsSection>
    )
}
