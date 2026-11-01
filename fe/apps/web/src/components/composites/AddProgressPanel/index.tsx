import { Text } from "@starci/grammar/common"
import { KnowledgeRowList } from "@/components/composites/KnowledgeRows"
import type { KnowledgeRowView } from "@/components/composites/KnowledgeRows"

/** The documents a drawer queued, each with where its reading stands. */
export interface AddProgressPanelProps {
    readonly title: string
    readonly rows: ReadonlyArray<KnowledgeRowView>
    readonly isPending: boolean
}

/** What the person just added and how far each document got: the stage, the count and the bar while it is read, then what it learnt or why it failed. Nothing is drawn while nothing was added. */
export const AddProgressPanel = (props: AddProgressPanelProps) =>
    props.rows.length === 0 ? null : (
        <>
            <Text size="sm" weight="medium">
                {props.title}
            </Text>
            <KnowledgeRowList label={props.title} rows={props.rows} isPending={props.isPending} />
        </>
    )
