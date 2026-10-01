import { nivoIconSource } from "../../leaves/Icon";
import { Icon, Text } from "@starci/grammar/common";



/** Resolved task identity and completion state. */
export type TaskProgressRowData = { readonly id: string; readonly title?: string; readonly fact?: string; readonly isComplete?: boolean }
/** Props for one task progress row. */
export type TaskProgressRowProps = { readonly props: TaskProgressRowData; readonly isLoading?: boolean }

/** Render one read-only task row. */
export const TaskProgressRow = (props: TaskProgressRowProps) => (
    <div>
        <Icon source={nivoIconSource(props.props.isComplete === true ? "complete" : "pending", "leading")} usage="leading" isSkeleton={props.isLoading} />
        <Text isSkeleton={props.isLoading}>{props.props.title}</Text>
        <Text size="xs" isSkeleton={props.isLoading}>{props.props.fact}</Text>
    </div>
)
