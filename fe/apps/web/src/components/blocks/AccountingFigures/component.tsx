import { FiguresStrip } from "@/components/composites/FiguresStrip"
import type { FiguresStripProps } from "@/components/composites/FiguresStrip"

/** Props for {@link AccountingFiguresBase}. */
export interface AccountingFiguresBaseProps {
    readonly props: FiguresStripProps
}

/** Draws the ribbon of the Accounting workbench: income, receivables, unmatched payments and ageing. */
export const AccountingFiguresBase = (props: AccountingFiguresBaseProps) => <FiguresStrip {...props.props} />
