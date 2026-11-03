import type { ReactElement } from "react"
import { type LeadGenWorkbenchDataView, type LeadGenWorkbenchActions, LEADGEN_TABS } from "@/modules/types"
import { Grid, Stack, Tabs } from "@starci/grammar/common"
import { WorkbenchWhyFrame } from "@/components/frames/WorkbenchWhyFrame"
import { ConnectionsRegion } from "@/components/composites/ConnectionsRegion"
import { DoneRegion } from "@/components/composites/DoneRegion"
import { FiguresStrip } from "@/components/composites/FiguresStrip"
import { KnowledgeRegion } from "@/components/composites/KnowledgeRegion"
import { LeadGenCommentList } from "@/components/composites/LeadGenCommentList"
import { LeadGenRowList } from "@/components/composites/LeadGenRowList"
import { SlotView } from "@/components/composites/SlotView"
import { WaitingRegion } from "@/components/composites/WaitingRegion"
import { WorkbenchPaneRows } from "@/components/composites/WorkbenchPaneRows"

/** The four actual Lead Gen panels and the recorded-explanation arrangement. */
export const LEADGEN_WORKBENCH_SHAPES: readonly [...typeof LEADGEN_TABS, "explanation"] = [...LEADGEN_TABS, "explanation"]
type LeadGenWorkbenchShape = (typeof LEADGEN_WORKBENCH_SHAPES)[number]

/** Plain resolved read models and atomic commands; shape never carries render trees. */
export interface LeadGenWorkbenchBaseProps {
    readonly shape: LeadGenWorkbenchShape
    readonly props: LeadGenWorkbenchDataView
    readonly on: LeadGenWorkbenchActions
}

const panelId = (id: string): string => `agent-dashboard-panel-${id}`

const ModulePanel = (props: LeadGenWorkbenchBaseProps) => (
    <SlotView
        {...props.props.panel}
        onRetry={props.on.retry}
        render={(panel, isLoading) => {
            switch (props.shape) {
                case "leads":
                    return <LeadGenRowList {...panel.leads} isSkeleton={isLoading} />
                case "sources":
                    return <LeadGenRowList {...panel.sources} isSkeleton={isLoading} />
                case "handoffs":
                    return <LeadGenRowList {...panel.handoffs} isSkeleton={isLoading} />
                case "comments":
                    return (
                        <LeadGenCommentList
                            {...panel.comments}
                            isSkeleton={isLoading}
                            onEdit={props.on.comments.edit}
                            onCancel={props.on.comments.cancel}
                            onDraft={props.on.comments.draft}
                            onApprove={props.on.comments.approve}
                            onRetry={props.on.comments.retry}
                        />
                    )
                case "explanation":
                    return null
            }
        }}
    />
)

const DashboardCards = (props: Omit<LeadGenWorkbenchBaseProps, "shape">) => {
    const regions = props.props.regions
    return (
        <Grid kind="cards" columns={3}>
            <SlotView
                {...regions.done}
                onRetry={props.on.retryDashboard}
                render={(done, isLoading) => (
                    <DoneRegion label={regions.done.label} view={done} isLoading={isLoading} />
                )}
            />
            <SlotView
                {...regions.connections}
                onRetry={props.on.retryDashboard}
                render={(connections, isLoading) => (
                    <ConnectionsRegion label={regions.connections.label} view={connections} isLoading={isLoading} />
                )}
            />
            <SlotView
                {...regions.knowledge}
                onRetry={props.on.retryDashboard}
                render={(knowledge, isLoading) => (
                    <KnowledgeRegion label={regions.knowledge.label} view={knowledge} isLoading={isLoading} />
                )}
            />
        </Grid>
    )
}

const Overview = (props: LeadGenWorkbenchBaseProps) => {
    const view = props.props
    return (
        <Stack gap="region">
            <SlotView
                {...view.regions.waiting}
                onRetry={props.on.retryDashboard}
                render={(waiting, isLoading) => (
                    <WaitingRegion label={view.regions.waiting.label} view={waiting} isLoading={isLoading} />
                )}
            />
            <SlotView
                {...view.ribbon}
                onRetry={props.on.retry}
                render={(items, isLoading) => (
                    <FiguresStrip label={view.ribbon.label} items={items} isLoading={isLoading} />
                )}
            />
            <Tabs
                label={view.tabsLabel}
                selectedKey={view.selectedTab}
                inset="none"
                labelVisibility="always"
                items={view.tabs}
                panelId={panelId}
                onSelect={props.on.selectTab}
            />
            <div role="tabpanel" id={panelId(view.selectedTab)}>
                <ModulePanel {...props} />
            </div>
            <DashboardCards props={props.props} on={props.on} />
        </Stack>
    )
}

const Explanation = (props: Omit<LeadGenWorkbenchBaseProps, "shape">) => {
    const view = props.props
    const why = view.why
    return (
        <WorkbenchWhyFrame
            label={why.paneLabel}
            listLabel={why.listLabel}
            openLabel={why.openLabel}
            closeLabel={why.closeLabel}
            view={why.view}
            labels={why.labels}
            onClose={props.on.closeWhy}
        >
            <SlotView
                {...view.regions.waiting}
                onRetry={props.on.retryDashboard}
                render={(waiting, isLoading) => (
                    <WorkbenchPaneRows
                        label={view.regions.waiting.label}
                        rows={waiting.rows}
                        openLabel={waiting.openLabel}
                        isLoading={isLoading}
                    />
                )}
            />
            <SlotView
                {...view.regions.done}
                onRetry={props.on.retryDashboard}
                render={(done, isLoading) => (
                    <WorkbenchPaneRows
                        label={view.regions.done.label}
                        rows={done.rows}
                        openLabel={null}
                        isLoading={isLoading}
                    />
                )}
            />
        </WorkbenchWhyFrame>
    )
}

/** The only shapes are real Lead Gen panels and the explanation layout; all statuses stay in their own SlotViews. */
export const LeadGenWorkbenchBase = (props: LeadGenWorkbenchBaseProps): ReactElement => {
    switch (props.shape) {
        case "leads":
        case "sources":
        case "comments":
        case "handoffs":
            return <Overview {...props} />
        case "explanation":
            return <Explanation props={props.props} on={props.on} />
    }
}
