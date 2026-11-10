import { SurfaceCard } from "@starci/grammar/common"
import type { OverviewKpiView } from "@/modules/types"

/** What the key figures card is told. */
interface OverviewKpiCardProps {
    readonly props: {
        /** Names the strip for assistive technology. */
        readonly label: string
        readonly kpis: ReadonlyArray<OverviewKpiView>
        readonly isLoading: boolean
    }
}

/** The key figures of the period in one card, each with how it moved against the period before. */
export const OverviewKpiCard = (props: OverviewKpiCardProps) => (
    <SurfaceCard
        kind="figures"
        ariaLabel={props.props.label}
        isLoading={props.props.isLoading}
        items={props.props.kpis.map((kpi) => ({ id: kpi.id, term: kpi.term, value: kpi.value, meta: kpi.meta }))}
    />
)
