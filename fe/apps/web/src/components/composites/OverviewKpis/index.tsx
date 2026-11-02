import { SurfaceCard } from "@starci/grammar/common"

/** One count: its label, value, the list it opens and whether a non-zero value asks for attention. */
interface OverviewKpi {
    readonly id: string
    readonly label: string
    readonly value: number
    readonly href: string
    readonly isAlert: boolean
}

/** The KPI band: the name of the region and the counts. */
interface OverviewKpisProps {
    readonly label: string
    readonly kpis: ReadonlyArray<OverviewKpi>
    /** The counts are placeholders: the cards draw their lines as skeleton and open nothing. */
    readonly isLoading: boolean
}

/** The overview's counts share one figure card; each native figure destination opens its filtered list. */
export const OverviewKpis = (props: OverviewKpisProps) => (
    <SurfaceCard
        kind="figures"
        label={props.label}
        isLoading={props.isLoading}
        items={props.kpis.map((kpi) => ({ id: kpi.id, term: kpi.label, value: kpi.value, href: kpi.href }))}
    />
)
