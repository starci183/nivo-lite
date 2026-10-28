import { GateBody } from "@/components/composites/GateBody"
import { SlotView } from "@/components/composites/SlotView"
import type { ReadGateBaseProps } from "@/modules/types"

/** Props for {@link VideoLibraryGateBase}: ready lets the blocks behind the gate draw; the other statuses are the gate's own. */
export type VideoLibraryGateBaseProps = ReadGateBaseProps<true>

/** Draws the blocks that need the video library once it is read, a skeleton of their panel while it is read, or the notice when it failed. */
export const VideoLibraryGateBase = (props: VideoLibraryGateBaseProps) => (
    <SlotView slot={props.props.slot} placeholder labels={props.props.slotLabels} onRetry={props.on.retry}>
        {(_ready, isSkeleton) => (
            <GateBody isSkeleton={isSkeleton} name={props.props.placeholder} content={props.shape.content} />
        )}
    </SlotView>
)
