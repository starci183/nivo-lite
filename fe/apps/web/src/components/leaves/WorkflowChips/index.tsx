import { Badge, Cluster } from "@starci/grammar/common"
import type { WorkflowChipView } from "@/modules/types"

/** A row of chips: a value bound at run time is pink, a fixed one is grey. */
interface WorkflowChipsProps {
    readonly chips: ReadonlyArray<WorkflowChipView>
}

/** The chips of a param list: pink for "= order.id", grey for a fixed value or a name. */
export const WorkflowChips = (props: WorkflowChipsProps) => (
    <Cluster gap="row">
        {props.chips.map((chip) => (
            <Badge key={chip.label} tone={chip.isDynamic ? "accent" : "neutral"}>
                {chip.label}
            </Badge>
        ))}
    </Cluster>
)
