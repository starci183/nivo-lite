import type { ReactNode } from "react"
import { SurfaceListCard } from "@starci/grammar/common"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** Props for {@link ContentWorkbenchGateBase}. */
export interface ContentWorkbenchGateBaseProps {
    /** The blocks behind the gate. */
    readonly shape: { readonly content: ReactNode }
    readonly props: {
        /** Ready lets the blocks behind the gate draw; the other statuses are the gate's own. */
        readonly slot: DataSlot<true>
        readonly slotLabels: SlotLabels
        /** The name of the panel drawn as a skeleton while the read waits; null draws nothing meanwhile. */
        readonly placeholder: string | null
    }
    readonly on: { readonly retry: () => void }
}

/** What the gate draws while its read waits and once it is ready. */
interface GateBodyProps {
    readonly isSkeleton: boolean
    readonly name: string | null
    readonly content: ReactNode
}

/** The blocks behind the gate once ready; while the read waits, the skeleton of their panel when it has a name. */
const GateBody = (props: GateBodyProps) => (
    <>
        {props.isSkeleton && props.name !== null ? <SurfaceListCard ariaLabel={props.name} isLoading /> : null}
        {props.isSkeleton ? null : props.content}
    </>
)

/** Draws the blocks that need the content workbench once it is read, a skeleton of their panel while it is read, or the notice when it failed. */
export const ContentWorkbenchGateBase = (props: ContentWorkbenchGateBaseProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder
        labels={props.props.slotLabels}
        forbidden="hide"
        onRetry={props.on.retry}
    >
        {(_ready, isSkeleton) => (
            <GateBody isSkeleton={isSkeleton} name={props.props.placeholder} content={props.shape.content} />
        )}
    </SlotView>
)
