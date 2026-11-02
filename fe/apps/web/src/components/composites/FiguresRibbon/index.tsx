import { SurfaceCard, type Figure } from "@starci/grammar/common"

/** What the ribbon of a workbench draws. */
type FiguresRibbonProps = {
    readonly label: string
    /** The stat items of the ribbon, already worded; the skeleton keeps the real terms with empty values. */
    readonly items: ReadonlyArray<Figure>
    readonly isLoading: boolean
}

/** The ribbon of a workbench: its figures in one card. The block that owns the slot wraps it in SlotView. */
export const FiguresRibbon = (props: FiguresRibbonProps) => (
    <SurfaceCard kind="figures" ariaLabel={props.label} isLoading={props.isLoading} items={props.items} />
)
