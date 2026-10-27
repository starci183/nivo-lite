import {
    KNOWLEDGE_ROWS_PLACEHOLDER,
    KnowledgeRowList,
    KnowledgeRowsSection,
} from "@/components/composites/KnowledgeRows"
import type { KnowledgeListView } from "@/components/composites/KnowledgeRows"
import { SlotView } from "@/components/composites/SlotView"

/** The list the connected the facts in force and the scheduled ones supplies. */
export interface BrainFactsBaseProps {
    readonly props: { readonly list: KnowledgeListView }
    readonly on: { readonly retry: () => void }
}

/** Draws the facts in force and the scheduled ones. */
export const BrainFactsBase = (props: BrainFactsBaseProps) => {
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
