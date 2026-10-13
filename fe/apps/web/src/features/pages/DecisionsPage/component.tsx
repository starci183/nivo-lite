import { DecisionsBoard } from "@/components/blocks/DecisionsBoard"
import type { DecisionKind } from "@/modules/types"

/** What the decision history page supplies: the modules to filter by and the filters it was opened with. */
export interface DecisionsPageBaseProps {
    readonly props: {
        readonly departments: ReadonlyArray<string>
        readonly kind: DecisionKind | null
        readonly department: string | null
    }
}

/** Draws the decision history page: the board with its filters. */
export const DecisionsPageBase = (props: DecisionsPageBaseProps) => (
    <DecisionsBoard departments={props.props.departments} kind={props.props.kind} department={props.props.department} />
)
