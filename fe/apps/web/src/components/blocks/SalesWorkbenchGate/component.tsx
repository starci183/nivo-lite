import type { ReactNode } from "react"
import { SurfaceListCard } from "@starci/grammar/common"
import { SlotBoundView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** Props for {@link SalesWorkbenchGateBase}. */
export interface SalesWorkbenchGateBaseProps {
    /** The blocks behind the gate. */
    readonly shape: { readonly content: ReactNode }
    readonly props: {
        /** The Sales workbench read: its items are not drawn here, the gate only waits for them. */
        readonly slot: DataSlot<boolean>
        readonly slotLabels: SlotLabels
        /** The name of the area, the label of its skeleton card while the workbench is read. */
        readonly placeholder: string
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the blocks that need the Sales workbench once it is read; meanwhile the skeleton of their panel, and a retry if the read failed. */
export const SalesWorkbenchGateBase = (props: SalesWorkbenchGateBaseProps) => (
    <SlotBoundView
        from={{ slot: props.props.slot, placeholder: true, slotLabels: props.props.slotLabels }}
        onRetry={props.on.retry}
    >
        {(_, isSkeleton) => (
            <>
                {isSkeleton ? <SurfaceListCard ariaLabel={props.props.placeholder} isLoading /> : null}
                {isSkeleton ? null : props.shape.content}
            </>
        )}
    </SlotBoundView>
)
