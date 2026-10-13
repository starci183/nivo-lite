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

/** The title, the region name and the counts. */
interface OverviewKpiBandBaseProps {
    readonly props: {
        readonly title: string
        readonly label: string
        readonly kpis: ReadonlyArray<OverviewKpiBandKpi>
    }
}

/** The line that introduces the open work, then the KPI band of counts that each open a filtered list. */
export const OverviewKpiBandBase = (props: OverviewKpiBandBaseProps) => (
    <>
        <SectionHeader level={2} title={props.props.title} />
        <OverviewKpis label={props.props.label} kpis={props.props.kpis} />
    </>
)
