import { SectionHeader } from "@starci/grammar/common"
import { OverviewKpis } from "@/components/composites/OverviewKpis"

/** One count of the KPI band. */
interface OverviewKpiBandKpi {
    readonly id: string
    readonly label: string
    readonly value: number
    readonly href: string
    readonly isAlert: boolean
}

/** The words and counts of the band. */
export interface OverviewKpiBandView {
    readonly title: string
    readonly label: string
    readonly kpis: ReadonlyArray<OverviewKpiBandKpi>
}

/** What the band draws while the dashboard is read: the five cards as inert geometry. */
export const OVERVIEW_KPI_BAND_PLACEHOLDER: OverviewKpiBandView = {
    title: "-",
    label: "-",
    kpis: ["open", "waiting", "today", "overdue", "leads"].map((id) => ({
        id,
        label: "-",
        value: 0,
        href: "",
        isAlert: false,
    })),
}

/** The title, the region name and the counts, and whether they are still placeholders. */
interface OverviewKpiBandBaseProps {
    readonly props: OverviewKpiBandView & { readonly isSkeleton: boolean }
}

/** The line that introduces the open work, then the KPI band of counts that each open a filtered list. */
export const OverviewKpiBandBase = (props: OverviewKpiBandBaseProps) => (
    <>
        <SectionHeader level={2} title={props.props.title} isSkeleton={props.props.isSkeleton} />
        <OverviewKpis label={props.props.label} kpis={props.props.kpis} isSkeleton={props.props.isSkeleton} />
    </>
)
