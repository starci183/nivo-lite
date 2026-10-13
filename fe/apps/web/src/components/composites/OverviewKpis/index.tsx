import { useMemo } from "react"
import { SurfaceCard, Text } from "@starci/grammar/common"
import type { WholeCardAction } from "@starci/grammar/common"
import { AccountingBlock } from "@/components/branches/AccountingBlock"
import { KPI_COPY_CLASS_NAME, KPI_GRID_CLASS_NAME } from "./classNames"

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
}

const wholeActionOf = (kpi: OverviewKpi): WholeCardAction => ({
    kind: "link",
    href: kpi.href,
    label: `${kpi.label}: ${kpi.value}`,
})

/** The KPI band: whole-action cards on the page canvas, each opening the filtered list. */
export const OverviewKpis = (props: OverviewKpisProps) => {
    const cards = useMemo(() => props.kpis.map((kpi) => ({ kpi, action: wholeActionOf(kpi) })), [props.kpis])
    return (
        <AccountingBlock label={props.label}>
            <div className={KPI_GRID_CLASS_NAME}>
                {cards.map(({ kpi, action }) => (
                    <SurfaceCard key={kpi.id} wholeAction={action}>
                        <div className={KPI_COPY_CLASS_NAME}>
                            <Text size="xs" tone="muted">
                                {kpi.label}
                            </Text>
                            <Text
                                size="metric-lead"
                                weight="semibold"
                                tone={kpi.isAlert && kpi.value > 0 ? "accent" : "default"}
                            >
                                {String(kpi.value)}
                            </Text>
                        </div>
                    </SurfaceCard>
                ))}
            </div>
        </AccountingBlock>
    )
}
