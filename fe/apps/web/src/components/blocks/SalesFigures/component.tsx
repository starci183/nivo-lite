import { FiguresStrip } from "@/components/composites/FiguresStrip"
import type { FiguresStripProps } from "@/components/composites/FiguresStrip"

/** Props for {@link SalesFiguresBase}. */
export interface SalesFiguresBaseProps {
    readonly props: FiguresStripProps
}

/** Draws the ribbon of the Sales workbench: open deals, the proposal value, won deals and the conversion. */
export const SalesFiguresBase = (props: SalesFiguresBaseProps) => <FiguresStrip {...props.props} />
