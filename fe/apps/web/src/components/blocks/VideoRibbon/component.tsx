import { FiguresStrip } from "@/components/composites/FiguresStrip"
import type { FiguresStripProps } from "@/components/composites/FiguresStrip"

/** Props for {@link VideoRibbonBase}. */
export interface VideoRibbonBaseProps {
    readonly props: FiguresStripProps
}

/** Draws the ribbon of the Video workbench: videos rendering, ready to publish, published and credits used. */
export const VideoRibbonBase = (props: VideoRibbonBaseProps) => <FiguresStrip {...props.props} />
