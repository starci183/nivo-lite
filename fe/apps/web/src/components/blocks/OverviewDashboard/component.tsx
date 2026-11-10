import { Button, Cluster, Page, Tabs } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { ReactNode } from "react"
import { OVERVIEW_PERIODS } from "@/modules/overview"
import { OverviewRegions } from "./regions"
import type { OverviewDashboardBaseProps } from "./types"

export type { OverviewDashboardBaseProps, OverviewDashboardCopy } from "./types"

/** The header's commands: the period pill switch of the same data, and the report file. */
const headerActions = (props: OverviewDashboardBaseProps): ReactNode => {
    const { copy, period } = props.props
    return (
        <Cluster gap="inline" align="center">
            <Tabs
                appearance="primary"
                label={copy.periodLabel}
                selectedKey={period}
                onSelect={(key) => {
                    const next = OVERVIEW_PERIODS.find((candidate) => candidate === key)
                    if (next !== undefined) props.on.setPeriod(next)
                }}
                items={[
                    { id: "today", label: copy.periods.today },
                    { id: "last_7_days", label: copy.periods.last_7_days },
                    { id: "last_30_days", label: copy.periods.last_30_days },
                    { id: "this_month", label: copy.periods.this_month },
                ]}
            />
            <Button intent="neutral" onPress={props.on.exportReport}>
                {copy.exportLabel}
            </Button>
        </Cluster>
    )
}

/**
 * Draws the owner's overview: the header band with the period and the report, then the key figures, the chart and funnel, the
 * channels, what waits for the owner and what the agents did, and the table of agents. A read that has not settled draws the same
 * regions as skeletons; a person who may not see takings is told so and sent to the agents.
 */
export const OverviewDashboardBase = (props: OverviewDashboardBaseProps) => (
    <Page
        measure="product"
        header={{
            breadcrumbs: "root",
            title: props.props.copy.title,
            description: props.props.copy.description,
            actions: headerActions(props),
        }}
    >
        <SlotView
            slot={props.props.slot}
            placeholder={props.props.placeholder}
            labels={props.props.labels}
            forbidden="notice"
            forbiddenDescription={props.props.copy.forbiddenBody}
            forbiddenAction={
                <Button intent="neutral" endArrow onPress={props.on.openAgents}>
                    {props.props.copy.agentsOpen}
                </Button>
            }
            errorLayout="band"
            onRetry={props.on.retry}
            render={(view, isLoading) => (
                <OverviewRegions view={view} isLoading={isLoading} page={props} isPhone={props.props.isPhone} />
            )}
        />
    </Page>
)
