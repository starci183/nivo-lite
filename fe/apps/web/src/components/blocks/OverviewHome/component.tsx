import { SlotView } from "@nivo-lite/agent-sdk/client"
import { Button, Cluster, Page, Tabs, type PageHeaderContent } from "@starci/grammar/common"
import { OverviewRegions } from "@/components/frames/OverviewRegions"
import { StaffHomeRegions } from "@/components/frames/StaffHomeRegions"
import type { OverviewHomeBaseProps } from "./types"

export type { OverviewHomeBaseProps, OverviewManagerCopy, OverviewHomeShape } from "./types"

/** The header of the shape: the owner's has the period pill switch and the report file, a member of staff's has the words only. */
const headerOf = (props: OverviewHomeBaseProps): PageHeaderContent => {
    if (props.props.shape === "staff") {
        const { title, description } = props.props.staff
        return { breadcrumbs: "root", title, description }
    }
    const { copy, period, periods } = props.props.manager
    return {
        breadcrumbs: "root",
        title: copy.title,
        description: copy.description,
        actions: (
            <Cluster gap="inline" align="center">
                <Tabs
                    appearance="primary"
                    label={copy.periodLabel}
                    selectedKey={period}
                    onSelect={(key) => {
                        const next = periods.find((candidate) => candidate === key)
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
        ),
    }
}

/** The regions of the owner's overview, each read through its own status. */
const ManagerBody = (props: OverviewHomeBaseProps) => {
    const page = props.props.manager
    return (
        <SlotView
            slot={page.slot}
            placeholder={page.placeholder}
            labels={page.labels}
            forbidden="notice"
            forbiddenDescription={page.copy.forbiddenBody}
            forbiddenAction={
                <Button intent="neutral" endArrow onPress={props.on.openAgents}>
                    {page.copy.agentsOpen}
                </Button>
            }
            errorLayout="band"
            onRetry={props.on.retry}
            render={(view, isLoading) => (
                <OverviewRegions
                    props={{
                        view,
                        isLoading,
                        copy: page.copy,
                        isPhone: page.isPhone,
                        chatHref: page.chatHref,
                        agentsHref: page.agentsHref,
                    }}
                    on={{ openHref: props.on.openHref }}
                />
            )}
        />
    )
}

/**
 * Draws the home of the workspace on one `Page`: the shape `manager` is the owner's overview (the header band with the period and the
 * report, the core figures, what waits for the owner beside what the agents did, the table of agents; a
 * read that has not settled draws the same regions as skeletons, and a person who may not see takings is told so and sent to the
 * agents), the shape `staff` is a member's day (their figures, the work that waits for them beside their recent chats, the pages they
 * can open).
 */
export const OverviewHomeBase = (props: OverviewHomeBaseProps) => (
    <Page measure="product" header={headerOf(props)}>
        {props.props.shape === "staff" ? (
            <StaffHomeRegions
                props={{
                    figuresLabel: props.props.staff.figuresLabel,
                    figures: props.props.staff.figures,
                    isFiguresLoading: props.props.staff.isFiguresLoading,
                    work: props.props.staff.work,
                    chats: props.props.staff.chats,
                    shortcuts: props.props.staff.shortcuts,
                }}
                on={{ open: props.on.open }}
            />
        ) : (
            <ManagerBody {...props} />
        )}
    </Page>
)
