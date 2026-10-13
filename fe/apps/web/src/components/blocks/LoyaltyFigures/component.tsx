import { FiguresStrip } from "@/components/composites/FiguresStrip"
import type { FiguresStripProps } from "@/components/composites/FiguresStrip"

/** Props for {@link LoyaltyFiguresBase}. */
export interface LoyaltyFiguresBaseProps {
    readonly props: FiguresStripProps
}

/** Draws the figures strip of the loyalty workbench above its tabs. */
export const LoyaltyFiguresBase = (props: LoyaltyFiguresBaseProps) => <FiguresStrip {...props.props} />
