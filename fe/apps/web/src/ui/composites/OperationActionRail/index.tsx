import { Button } from "@starci/grammar/common";


/** One lifecycle action resolved by the owning domain block. */
export type OperationAction = { readonly id: string; readonly label: string; readonly disabled?: boolean; readonly pending?: boolean }
/** Stable rail identity and its ordered operations. */
export type OperationActionRailData = { readonly id: string; readonly actions: ReadonlyArray<OperationAction> }
/** Action selected by the reader. */
export type OperationActionRailActions = { readonly select?: (id: string) => void }
/** Props for the lifecycle action rail. */
export type OperationActionRailProps = { readonly props: OperationActionRailData; readonly on?: OperationActionRailActions; readonly isLoading?: boolean }

/** Render the ordered lifecycle controls. */
export const OperationActionRail = (props: OperationActionRailProps) => (
    <div>
        {props.props.actions.map((action) => (
            <Button key={action.id} isDisabled={action.disabled} isPending={action.pending} isSkeleton={props.isLoading} onPress={() => props.on?.select?.(action.id)}>{action.label}</Button>
        ))}
    </div>
)
