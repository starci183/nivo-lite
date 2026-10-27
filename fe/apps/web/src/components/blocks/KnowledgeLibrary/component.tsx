import { Select } from "@starci/grammar/common"
import {
    KNOWLEDGE_ROWS_PLACEHOLDER,
    KnowledgeRowList,
    KnowledgeRowsSection,
} from "@/components/composites/KnowledgeRows"
import type { KnowledgeListView } from "@/components/composites/KnowledgeRows"
import { SlotView } from "@/components/composites/SlotView"
import { FILTER_CLASS_NAME } from "./classNames"

/** The list and the filter the connected documents list supplies. */
export interface KnowledgeLibraryBaseProps {
    readonly props: {
        readonly list: KnowledgeListView
        readonly filterLabel: string
        readonly selectPlaceholder: string
        readonly filterOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly filter: string
    }
    readonly on: {
        readonly setFilter: (value: string | null) => void
        readonly retry: () => void
    }
}

/** Draws the documents of the workspace: a filter by agent and one row per document with its status, note and retry. */
export const KnowledgeLibraryBase = (props: KnowledgeLibraryBaseProps) => {
    const list = props.props.list
    return (
        <KnowledgeRowsSection
            section={list.section}
            isPending={list.isPending}
            before={
                <div className={FILTER_CLASS_NAME}>
                    <Select
                        label={props.props.filterLabel}
                        name="module"
                        options={props.props.filterOptions}
                        placeholder={props.props.selectPlaceholder}
                        value={props.props.filter}
                        onValueChange={props.on.setFilter}
                    />
                </div>
            }
        >
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
