import { DescriptionList, EmptyNotice, SurfaceCard } from "@starci/grammar/common"
import type { DescriptionListStatItem } from "@starci/grammar/common"

/** Props for {@link FiguresStrip}. */
export interface FiguresStripProps {
    readonly label: string
    /** The figures are not read yet: the terms stay real, the values draw as skeleton lines. */
    readonly isLoading: boolean
    /** The figures could not be read. */
    readonly isFailed: boolean
    readonly failedTitle: string
    readonly failedBody: string
    /** The four stat items; while loading, their terms stay real and the values draw as skeleton lines. */
    readonly items: ReadonlyArray<DescriptionListStatItem>
}

/** Draws the ribbon of a workbench (its four figures in one card), its loading skeleton, or the notice that they could not be read. */
export const FiguresStrip = (props: FiguresStripProps) => {
    if (props.isFailed) {
        return (
            <SurfaceCard ariaLabel={props.failedTitle}>
                <EmptyNotice message={props.failedTitle} description={props.failedBody} />
            </SurfaceCard>
        )
    }
    return (
        <SurfaceCard ariaLabel={props.label}>
            <DescriptionList layout="stat-strip" isDivided isLoading={props.isLoading} items={props.items} />
        </SurfaceCard>
    )
}
