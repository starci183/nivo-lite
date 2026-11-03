// legacy: delete when Loyalty becomes a JSON module
import type { ReactNode } from "react"
import { SurfaceCard } from "@starci/grammar/common"
import type { Figure } from "@starci/grammar/common"

/** Props for {@link FiguresStrip}. */
interface FiguresStripProps {
    readonly label: string
    /** The four figure cells; while `isLoading`, their terms stay real and the values draw as skeleton lines. */
    readonly items: ReadonlyArray<Figure>
    readonly isLoading: boolean
}

/** Draws the ribbon of a workbench (its four figures in one card); the status of the read is drawn by the block through SlotView. */
export const FiguresStrip = (props: FiguresStripProps): ReactNode => (
    <SurfaceCard kind="figures" ariaLabel={props.label} isLoading={props.isLoading} items={props.items} />
)
