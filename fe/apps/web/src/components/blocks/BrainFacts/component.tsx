import { Alert } from "@starci/grammar/common"
import {
    KNOWLEDGE_ROWS_PLACEHOLDER,
    KnowledgeRowList,
    KnowledgeRowsSection,
    rowListPropsOf,
} from "@/components/composites/KnowledgeRows"
import type { KnowledgeListView } from "@/components/composites/KnowledgeRows"
import { SlotView } from "@/components/composites/SlotView"

/** The list the connected the facts in force and the scheduled ones supplies. */
export interface BrainFactsBaseProps {
    readonly props: {
        readonly list: KnowledgeListView
        /** Something is due: a scheduled value waits to take over or a value in force has ended. Nothing is drawn for it while undefined. */
        readonly maintain?: { readonly title: string; readonly body: string; readonly actionLabel: string } | undefined
    }
    readonly on: { readonly retry: () => void; readonly maintain: () => void }
}

/** Draws the facts in force and the scheduled ones. */
export const BrainFactsBase = (props: BrainFactsBaseProps) => {
    const list = props.props.list
    const maintain = props.props.maintain
    return (
        <KnowledgeRowsSection
            isHeadingInCard
            section={list.section}
            isPending={list.isPending}
            before={
                maintain === undefined ? null : (
                    <Alert
                        tone="cautionary"
                        title={maintain.title}
                        description={maintain.body}
                        action={{ label: maintain.actionLabel, onAction: props.on.maintain }}
                    />
                )
            }
        >
            <SlotView
                slot={list.slot}
                placeholder={KNOWLEDGE_ROWS_PLACEHOLDER}
                labels={list.slotLabels}
                onRetry={props.on.retry}
            >
                {(rows, isSkeleton) => (
                    <KnowledgeRowList {...rowListPropsOf(list)} rows={rows} isSkeleton={isSkeleton} />
                )}
            </SlotView>
        </KnowledgeRowsSection>
    )
}
