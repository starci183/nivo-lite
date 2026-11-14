import { Grid, Stack } from "@starci/grammar/common"
import { OverviewAgentsCard } from "@/components/composites/OverviewAgentsCard"
import { OverviewApprovalsCard } from "@/components/composites/OverviewApprovalsCard"
import { OverviewKpiCard } from "@/components/composites/OverviewKpiCard"
import { OverviewSavingsCard } from "@/components/composites/OverviewSavingsCard"
import type { OverviewRegionsProps } from "./types"

export type { OverviewRegionsCopy } from "./types"

/** What a region that has no command is told. */
type RegionFigures = Pick<OverviewRegionsProps, "props">

const Kpis = (props: RegionFigures) => (
    <OverviewKpiCard
        props={{ label: props.props.copy.kpisLabel, kpis: props.props.view.kpis, isLoading: props.props.isLoading }}
    />
)

const Approvals = (props: OverviewRegionsProps) => {
    const { approvals } = props.props.copy
    const { view } = props.props
    return (
        <OverviewApprovalsCard
            props={{
                title: approvals.title,
                count: view.approvals.count,
                moreLabel: approvals.more,
                emptyTitle: approvals.emptyTitle,
                emptyBody: approvals.emptyBody,
                items: view.approvals.items,
                hasMore: view.approvals.hasMore,
                isLoading: props.props.isLoading,
            }}
            allHref={props.props.chatHref}
            on={{ open: props.on.openHref }}
        />
    )
}

const Savings = (props: RegionFigures) => (
    <OverviewSavingsCard
        props={{
            title: props.props.copy.savings.title,
            hoursNote: props.props.copy.savings.hoursNote,
            helpLabel: props.props.copy.savings.help,
            savings: props.props.view.savings,
            isLoading: props.props.isLoading,
        }}
    />
)

const Agents = (props: RegionFigures) => {
    const { agents } = props.props.copy
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
                agents: props.props.view.agents,
                isLoading: props.props.isLoading,
            }}
            href={props.props.agentsHref}
        />
    )
}

/** The regions of the owner's overview in the order a screen reads them: the desktop's rows, or a phone's what-needs-you first. */
export const OverviewRegions = (props: OverviewRegionsProps) => {
    if (props.props.isPhone)
        return (
            <Stack gap="section">
                <Kpis {...props} />
                <Approvals {...props} />
                <Savings {...props} />
                <Agents {...props} />
            </Stack>
        )
    return (
        <Stack gap="section">
            <Kpis {...props} />
            <Grid kind="main-rail" railWidth="medium" align="stretch" primary={<Approvals {...props} />} rail={<Savings {...props} />} />
            <Agents {...props} />
        </Stack>
    )
}
