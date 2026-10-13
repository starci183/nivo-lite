import { DescriptionList, EmptyNotice, Skeleton, SurfaceCard } from "@starci/grammar/common"
import type { DescriptionListStatItem } from "@starci/grammar/common"

/** Props for {@link FiguresStrip}. */
export interface FiguresStripProps {
    readonly label: string
    readonly state: "loading" | "failed" | "ready"
    readonly failedTitle: string
    readonly failedBody: string
    readonly items: ReadonlyArray<DescriptionListStatItem>
}

/** Draws a row of figures above the tabs of a workbench, or its loading skeleton, or the notice that they could not be read. */
export const FiguresStrip = (props: FiguresStripProps) => {
    if (props.state === "loading") return <Skeleton aria-label={props.label} />
    if (props.state === "failed") {
        return (
            <SurfaceCard ariaLabel={props.failedTitle}>
                <EmptyNotice message={props.failedTitle} description={props.failedBody} />
            </SurfaceCard>
        )
    }
    return <DescriptionList layout="stat-strip" isDivided items={props.items} />
}
