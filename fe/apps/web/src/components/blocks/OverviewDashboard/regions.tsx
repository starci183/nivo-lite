import { Grid, Stack } from "@starci/grammar/common"
import { OverviewAgentsCard } from "@/components/composites/OverviewAgentsCard"
import { OverviewApprovalsCard } from "@/components/composites/OverviewApprovalsCard"
import { OverviewChannelsCard } from "@/components/composites/OverviewChannelsCard"
import { OverviewFunnelCard } from "@/components/composites/OverviewFunnelCard"
import { OverviewKpiCard } from "@/components/composites/OverviewKpiCard"
import { OverviewRevenueCard } from "@/components/composites/OverviewRevenueCard"
import { OverviewSavingsCard } from "@/components/composites/OverviewSavingsCard"
import type { OverviewView } from "@/modules/types"
import type { OverviewDashboardBaseProps } from "./types"

/** What a region of the body is drawn from: the figures, whether they are a placeholder, and the page's words and commands. */
interface RegionProps {
    readonly view: OverviewView
    readonly isLoading: boolean
    readonly page: OverviewDashboardBaseProps
}

const Kpis = (props: RegionProps) => (
    <OverviewKpiCard
        props={{ label: props.page.props.copy.kpisLabel, kpis: props.view.kpis, isLoading: props.isLoading }}
    />
)

const Chart = (props: RegionProps) => {
    const { copy, metric } = props.page.props
    return (
        <OverviewRevenueCard
            props={{
                title: copy.chart.title,
                note: copy.chart.note,
                switchLabel: copy.chart.switchLabel,
                revenueLabel: copy.chart.revenue,
                ordersLabel: copy.chart.orders,
                chartLabels: { revenue: copy.chart.revenueLabel, orders: copy.chart.ordersLabel },
                emptyLabel: copy.chart.empty,
                metric,
                revenueBars: props.view.revenueBars,
                orderBars: props.view.orderBars,
                isLoading: props.isLoading,
            }}
            on={{ select: props.page.on.selectMetric }}
        />
    )
}

const Funnel = (props: RegionProps) => (
    <OverviewFunnelCard
        props={{
            title: props.page.props.copy.funnel.title,
            note: props.page.props.copy.funnel.note,
            steps: props.view.funnel,
            isLoading: props.isLoading,
        }}
    />
)

const Channels = (props: RegionProps) => {
    const { channels } = props.page.props.copy
    return (
        <OverviewChannelsCard
            props={{
                title: channels.title,
                note: channels.note,
                openLabel: channels.open,
                columns: { channel: channels.channel, customers: channels.customers, revenue: channels.revenue },
                emptyTitle: channels.emptyTitle,
                emptyBody: channels.emptyBody,
                channels: props.view.channels,
                isLoading: props.isLoading,
            }}
            href={props.page.props.inboxHref}
        />
    )
}

const Approvals = (props: RegionProps) => {
    const { approvals } = props.page.props.copy
    return (
        <OverviewApprovalsCard
            props={{
                title: approvals.title,
                count: props.view.approvals.count,
                moreLabel: approvals.more,
                emptyTitle: approvals.emptyTitle,
                emptyBody: approvals.emptyBody,
                items: props.view.approvals.items,
                hasMore: props.view.approvals.hasMore,
                isLoading: props.isLoading,
            }}
            allHref={props.page.props.inboxHref}
            on={{ open: props.page.on.openHref }}
        />
    )
}

const Savings = (props: RegionProps) => (
    <OverviewSavingsCard
        props={{
            title: props.page.props.copy.savings.title,
            hoursNote: props.page.props.copy.savings.hoursNote,
            helpLabel: props.page.props.copy.savings.help,
            savings: props.view.savings,
            isLoading: props.isLoading,
        }}
    />
)

const Agents = (props: RegionProps) => {
    const { agents } = props.page.props.copy
    return (
        <OverviewAgentsCard
            props={{
                title: agents.title,
                note: agents.note,
                openLabel: agents.open,
                columns: {
                    agent: agents.agent,
                    tasks: agents.tasks,
                    auto: agents.auto,
                    waiting: agents.waiting,
                    errors: agents.errors,
                    response: agents.response,
                    saved: agents.saved,
                    credits: agents.credits,
                },
                emptyTitle: agents.emptyTitle,
                emptyBody: agents.emptyBody,
                agents: props.view.agents,
                isLoading: props.isLoading,
            }}
            href={props.page.props.agentsHref}
        />
    )
}

/** The regions in the order a screen reads them: the desktop's rows, or a phone's what-needs-you first. */
export const OverviewRegions = (props: RegionProps & { readonly isPhone: boolean }) => {
    if (props.isPhone)
        return (
            <Stack gap="section">
                <Kpis {...props} />
                <Approvals {...props} />
                <Chart {...props} />
                <Funnel {...props} />
                <Channels {...props} />
                <Savings {...props} />
                <Agents {...props} />
            </Stack>
        )
    return (
        <Stack gap="section">
            <Kpis {...props} />
            <Grid
                kind="main-rail"
                railWidth="medium"
                align="stretch"
                primary={<Chart {...props} />}
                rail={<Funnel {...props} />}
            />
            <Grid
                kind="featured"
                leading={<Channels {...props} />}
                featured={<Approvals {...props} />}
                trailing={<Savings {...props} />}
            />
            <Agents {...props} />
        </Stack>
    )
}
