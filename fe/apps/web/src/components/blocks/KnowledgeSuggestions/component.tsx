import { Button } from "@starci/grammar/common"
import {
    KNOWLEDGE_ROWS_PLACEHOLDER,
    KnowledgeRowList,
    KnowledgeRowsSection,
    rowListPropsOf,
} from "@/components/composites/KnowledgeRows"
import type { KnowledgeListView, KnowledgeRowListProps } from "@/components/composites/KnowledgeRows"
import { SlotView } from "@/components/composites/SlotView"

/** The lists the connected suggestions supply. */
export interface KnowledgeSuggestionsBaseProps {
    readonly props: {
        readonly list: KnowledgeListView
        /** The control that shows the rest of the ideas; nothing is drawn while undefined. */
        readonly more?: { readonly label: string } | undefined
        /** The ideas that were set aside; nothing is drawn for them while undefined. */
        readonly skipped?: KnowledgeRowListProps | undefined
    }
    readonly on: { readonly toggleMore: () => void }
}

/** Draws the ideas for what to add, none of them required: the most relevant few, a way to see the rest, and the ones that were set aside. */
export const KnowledgeSuggestionsBase = (props: KnowledgeSuggestionsBaseProps) => {
    const list = props.props.list
    return (
        <KnowledgeRowsSection isHeadingInCard section={list.section} isPending={list.isPending}>
            <SlotView slot={list.slot} placeholder={KNOWLEDGE_ROWS_PLACEHOLDER} labels={list.slotLabels}>
                {(rows, isSkeleton) => (
                    <KnowledgeRowList {...rowListPropsOf(list)} rows={rows} isSkeleton={isSkeleton} />
                )}
            </SlotView>
            {props.props.more === undefined ? null : (
                <Button intent="neutral" onPress={props.on.toggleMore}>
                    {props.props.more.label}
                </Button>
            )}
            {props.props.skipped === undefined ? null : <KnowledgeRowList {...props.props.skipped} />}
        </KnowledgeRowsSection>
    )
}
