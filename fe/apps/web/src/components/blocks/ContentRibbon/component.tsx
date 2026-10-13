import { FiguresStrip } from "@/components/composites/FiguresStrip"
import type { FiguresStripProps } from "@/components/composites/FiguresStrip"

/** Props for {@link ContentRibbonBase}. */
export interface ContentRibbonBaseProps {
    readonly props: FiguresStripProps
}

/** Draws the ribbon of the Content workbench: posts waiting, published, the next post and pillar coverage. */
export const ContentRibbonBase = (props: ContentRibbonBaseProps) => <FiguresStrip {...props.props} />
