import { GateBody } from "@/components/composites/GateBody"
import { SlotView } from "@/components/composites/SlotView"
import type { ReadGateBaseProps } from "@/modules/types"

/** Props for {@link SalesWorkbenchGateBase}: the gate waits for the Sales workbench read. */
export type SalesWorkbenchGateBaseProps = ReadGateBaseProps<boolean>

/** Draws the blocks that need the Sales workbench once it is read; meanwhile the skeleton of their panel, and a retry if the read failed. */
export const SalesWorkbenchGateBase = (props: SalesWorkbenchGateBaseProps) => (
    <SlotView slot={props.props.slot} placeholder labels={props.props.slotLabels} onRetry={props.on.retry}>
        {(_, isSkeleton) => (
            <GateBody isSkeleton={isSkeleton} name={props.props.placeholder} content={props.shape.content} />
        )}
    </SlotView>
)
