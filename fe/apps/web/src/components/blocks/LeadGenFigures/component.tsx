import { FiguresStrip } from "@/components/composites/FiguresStrip"
import type { FiguresStripProps } from "@/components/composites/FiguresStrip"

/** Props for {@link LeadGenFiguresBase}. */
export interface LeadGenFiguresBaseProps {
    readonly props: FiguresStripProps
}

/** Draws the ribbon of the Lead Gen workbench: new today, hot and waiting, first reply and conversion. */
export const LeadGenFiguresBase = (props: LeadGenFiguresBaseProps) => <FiguresStrip {...props.props} />
