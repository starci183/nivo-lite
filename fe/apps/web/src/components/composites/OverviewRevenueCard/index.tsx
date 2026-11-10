import { BarChart, EmptyNotice, SurfaceCard } from "@starci/grammar/common"
import type { OverviewBarView } from "@/modules/types"

/** The two things the chart can measure. */
export type OverviewChartMetric = "revenue" | "orders"

/** What the revenue chart card is told. */
interface OverviewRevenueCardProps {
    readonly props: {
        readonly title: string
        /** The one short line beside the title: what the revenue is made of. */
        readonly note: string
        readonly switchLabel: string
        readonly revenueLabel: string
        readonly ordersLabel: string
        readonly chartLabels: { readonly revenue: string; readonly orders: string }
        readonly emptyLabel: string
        readonly metric: OverviewChartMetric
        readonly revenueBars: ReadonlyArray<OverviewBarView>
        readonly orderBars: ReadonlyArray<OverviewBarView>
        readonly isLoading: boolean
    }
    readonly on: { readonly select: (metric: OverviewChartMetric) => void }
}

/** The bars of the days of the period, revenue or orders, one switch between the two (the same data, two measures). */
export const OverviewRevenueCard = (props: OverviewRevenueCardProps) => {
    const copy = props.props
    const bars = copy.metric === "revenue" ? copy.revenueBars : copy.orderBars
    return (
        <SurfaceCard
            label={copy.title}
            fact={copy.note}
            headingLevel={2}
            isLoading={copy.isLoading}
            headers={[
                {
                    kind: "switch",
                    label: copy.switchLabel,
                    items: [
                        { id: "revenue", label: copy.revenueLabel },
                        { id: "orders", label: copy.ordersLabel },
                    ],
                    selectedKey: copy.metric,
                    onSelect: (key) => props.on.select(key === "orders" ? "orders" : "revenue"),
                },
            ]}
        >
            <BarChart
                label={copy.metric === "revenue" ? copy.chartLabels.revenue : copy.chartLabels.orders}
                bars={bars}
                isLoading={copy.isLoading}
                empty={<EmptyNotice message={copy.emptyLabel} />}
            />
        </SurfaceCard>
    )
}
