import { useMemo } from "react"
import { Grid, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import type { WholeCardAction } from "@starci/grammar/common"
import { AccountingBlock } from "@/components/branches/AccountingBlock"

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
    readonly isSkeleton: boolean
}

const wholeActionOf = (kpi: OverviewKpi): WholeCardAction => ({
    kind: "link",
    href: kpi.href,
    label: `${kpi.label}: ${kpi.value}`,
})

/** The KPI band: whole-action cards on the page canvas, each opening the filtered list. */
export const OverviewKpis = (props: OverviewKpisProps) => {
    const cards = useMemo(
        () => props.kpis.map((kpi) => ({ kpi, action: props.isSkeleton ? undefined : wholeActionOf(kpi) })),
        [props.kpis, props.isSkeleton],
    )
    return (
        <AccountingBlock label={props.label}>
            <Grid kind="cards">
                {cards.map(({ kpi, action }) => (
                    <SurfaceCard key={kpi.id} {...(action === undefined ? {} : { wholeAction: action })}>
                        <Stack gap="identity">
                            <Text size="xs" tone="muted" isSkeleton={props.isSkeleton}>
                                {kpi.label}
                            </Text>
                            <Text
                                size="metric-lead"
                                weight="semibold"
                                tone={kpi.isAlert && kpi.value > 0 ? "accent" : "default"}
                                isSkeleton={props.isSkeleton}
                            >
                                {String(kpi.value)}
                            </Text>
                        </Stack>
                    </SurfaceCard>
                ))}
            </Grid>
        </AccountingBlock>
    )
}
