import type { ReactNode } from "react"
import { SurfaceListCard } from "@starci/grammar/common"
import { SlotBoundView } from "@/components/composites/SlotView"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** Props for {@link VideoLibraryGateBase}. */
export interface VideoLibraryGateBaseProps {
    /** The blocks behind the gate. */
    readonly shape: { readonly content: ReactNode }
    readonly props: {
        /** Ready lets the blocks behind the gate draw; the other statuses are the gate's own. */
        readonly slot: DataSlot<true>
        readonly slotLabels: SlotLabels
        /** The name of the panel drawn as a skeleton while the library is read. */
        readonly placeholder: string
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the blocks that need the video library once it is read, a skeleton of their panel while it is read, or the notice when it failed. */
export const VideoLibraryGateBase = (props: VideoLibraryGateBaseProps) => (
    <SlotBoundView
        from={{ slot: props.props.slot, placeholder: true, slotLabels: props.props.slotLabels }}
        onRetry={props.on.retry}
    >
        {(_ready, isSkeleton) => (
            <>
                {isSkeleton ? <SurfaceListCard ariaLabel={props.props.placeholder} isLoading /> : null}
                {isSkeleton ? null : props.shape.content}
            </>
        )}
    </SlotBoundView>
)
