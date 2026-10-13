import { FiguresStrip } from "@/components/composites/FiguresStrip"
import type { FiguresStripProps } from "@/components/composites/FiguresStrip"

/** Props for {@link BookingFiguresBase}. */
export interface BookingFiguresBaseProps {
    readonly props: FiguresStripProps
}

/** Draws the figures strip of the booking workbench above its tabs. */
export const BookingFiguresBase = (props: BookingFiguresBaseProps) => <FiguresStrip {...props.props} />
