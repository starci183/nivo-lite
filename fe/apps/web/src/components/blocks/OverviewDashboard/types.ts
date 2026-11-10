import type { OverviewChartMetric } from "@/components/composites/OverviewRevenueCard"
import type { OverviewPeriod } from "@/modules/overview"
import type { DataSlot, OverviewView, SlotLabels } from "@/modules/types"

/** The words of the page, resolved by the connected block. */
export interface OverviewDashboardCopy {
    readonly title: string
    readonly description: string
    readonly periodLabel: string
    readonly periods: Readonly<Record<OverviewPeriod, string>>
    readonly exportLabel: string
    readonly kpisLabel: string
    readonly forbiddenBody: string
    readonly agentsOpen: string
    readonly chart: {
        readonly title: string
        readonly note: string
        readonly switchLabel: string
        readonly revenue: string
        readonly orders: string
        readonly revenueLabel: string
        readonly ordersLabel: string
        readonly empty: string
    }
    readonly funnel: { readonly title: string; readonly note: string }
    readonly channels: {
        readonly title: string
        readonly note: string
        readonly open: string
        readonly channel: string
        readonly customers: string
        readonly revenue: string
        readonly emptyTitle: string
        readonly emptyBody: string
    }
    readonly approvals: {
        readonly title: string
        readonly more: string
        readonly emptyTitle: string
        readonly emptyBody: string
    }
    readonly savings: { readonly title: string; readonly hoursNote: string; readonly help: string }
    readonly agents: {
        readonly title: string
        readonly note: string
        readonly open: string
        readonly agent: string
        readonly tasks: string
        readonly auto: string
        readonly waiting: string
        readonly errors: string
        readonly response: string
        readonly saved: string
        readonly credits: string
        readonly emptyTitle: string
        readonly emptyBody: string
    }
}

/** What the overview page is told. */
export interface OverviewDashboardBaseProps {
    readonly props: {
        readonly copy: OverviewDashboardCopy
        readonly period: OverviewPeriod
        readonly slot: DataSlot<OverviewView>
        readonly placeholder: OverviewView
        readonly labels: SlotLabels
        /** The chart's measure. */
        readonly metric: OverviewChartMetric
        /** A phone's screen: what needs the owner comes before the chart. */
        readonly isPhone: boolean
        /** Where the head links of the regions lead: the Inbox and the agents. */
        readonly inboxHref: string
        readonly agentsHref: string
    }
    readonly on: {
        readonly setPeriod: (period: OverviewPeriod) => void
        readonly exportReport: () => void
        readonly selectMetric: (metric: OverviewChartMetric) => void
        readonly openHref: (href: string) => void
        readonly openInbox: () => void
        readonly openAgents: () => void
        readonly retry: () => void
    }
}
