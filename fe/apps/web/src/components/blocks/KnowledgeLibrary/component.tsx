import { Select } from "@starci/grammar/common"
import { KnowledgeRows } from "@/components/composites/KnowledgeRows"
import type { KnowledgeRowsProps } from "@/components/composites/KnowledgeRows"
import { FILTER_CLASS_NAME } from "./classNames"

/** The list and the filter the connected documents list supplies. */
export interface KnowledgeLibraryBaseProps {
    readonly props: {
        readonly list: KnowledgeRowsProps
        readonly filterLabel: string
        readonly filterOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly filter: string
    }
    readonly on: {
        readonly setFilter: (value: string | null) => void
    }
}

/** Draws the documents of the workspace: a filter by agent and one row per document with its status, note and retry. */
export const KnowledgeLibraryBase = (props: KnowledgeLibraryBaseProps) => (
    <KnowledgeRows
        {...props.props.list}
        before={
            <div className={FILTER_CLASS_NAME}>
                <Select
                    label={props.props.filterLabel}
                    name="module"
                    options={props.props.filterOptions}
                    value={props.props.filter}
                    isSkeleton={props.props.list.isLoading}
                    onValueChange={props.on.setFilter}
                />
            </div>
        }
    />
)
