import type { SalesWorkbenchViewData, SalesWorkbenchActions } from "@/modules/types"
import { ChatbotConversationBody } from "@/components/frames/ChatbotConversationBody"
import { Button, Grid, Stack, Tabs, Text } from "@starci/grammar/common"
import { WorkbenchWhyFrame } from "@/components/frames/WorkbenchWhyFrame"
import { SalesContractsBody } from "@/components/frames/SalesContractsBody"
import { SalesDecisionsBody } from "@/components/frames/SalesDecisionsBody"
import { SalesHandoffsBody } from "@/components/frames/SalesHandoffsBody"
import { ConnectionsRegion } from "@/components/composites/ConnectionsRegion"
import { DoneRegion } from "@/components/composites/DoneRegion"
import { FiguresStrip } from "@/components/composites/FiguresStrip"
import { GateBody } from "@/components/composites/GateBody"
import { KnowledgeRegion } from "@/components/composites/KnowledgeRegion"
import { SalesActivityRows } from "@/components/composites/SalesActivityRows"
import { SalesAttentionRows } from "@/components/composites/SalesAttentionRows"
import { SalesContractRows } from "@/components/composites/SalesContractRows"
import { SalesOrderRows } from "@/components/composites/SalesOrderRows"
import { SalesPipelineBoard } from "@/components/composites/SalesPipelineBoard"
import { SlotView } from "@/components/composites/SlotView"
import { WorkbenchPaneRows } from "@/components/composites/WorkbenchPaneRows"
import { WorkbenchWaitingList } from "@/components/composites/WorkbenchWaitingList"
import { SALES_WORKBENCH_TABS as SALES_TABS } from "@/modules/types"
/** The six Sales areas, optional customer conversation and explanation drawings. */
export const SALES_WORKBENCH_SHAPES = [...SALES_TABS, "conversation", "explanation"] as const
type SalesWorkbenchShape = (typeof SALES_WORKBENCH_SHAPES)[number]
interface SalesWorkbenchBaseProps {
    readonly shape: SalesWorkbenchShape
    readonly props: SalesWorkbenchViewData
    readonly on: SalesWorkbenchActions
}
const panelId = (id: string): string => `agent-dashboard-panel-${id}`
const Inbox = (props: Omit<SalesWorkbenchBaseProps, "shape">) => (
    <SlotView
        {...props.props.inbox}
        onRetry={props.on.inbox.reload}
        render={(inbox, isLoading) => <ChatbotConversationBody {...inbox} isLoading={isLoading} on={props.on.inbox} />}
    />
)
const Orders = (props: Omit<SalesWorkbenchBaseProps, "shape">) => {
    const view = props.props.orders,
        on = props.on.orders
    return (
        <Stack gap="section">
            <SlotView
                slot={view.slot}
                placeholder={view.placeholder}
                labels={view.labels}
                onRetry={on.retry}
                render={(rows, isLoading) => (
                    <SalesOrderRows title={view.title} empty={view.labels.empty} rows={rows} isLoading={isLoading} />
                )}
            />
            {view.paginationFailure === null ? null : (
                <Text size="sm" live="polite">
                    {view.paginationFailure}
                </Text>
            )}
            {view.hasNextPage || view.paginationFailure !== null ? (
                <Button
                    intent="neutral"
                    size="sm"
                    isPending={view.isLoadingMore}
                    isDisabled={view.isLoadingMore}
                    onPress={view.paginationFailure === null ? on.loadMore : on.retry}
                >
                    {view.paginationFailure === null ? view.loadMoreLabel : view.retryLabel}
                </Button>
            ) : null}
        </Stack>
    )
}
const Contracts = (props: Omit<SalesWorkbenchBaseProps, "shape">) => {
    const view = props.props.contracts,
        on = props.on.contracts
    return (
        <SalesContractsBody
            intro={view.intro}
            addLabel={view.addLabel}
            importLabel={view.importLabel}
            note={view.note}
            drawer={view.drawer}
            importDialog={view.importDialog}
            onAdd={on.add}
            onOpenImport={on.openImport}
            onDrawer={on.drawer}
            onImport={on.import}
        >
            <SlotView
                slot={view.rows}
                placeholder={view.rowsPlaceholder}
                labels={view.rowsLabels}
                onRetry={on.retry}
                render={(rows, isLoading) => (
                    <SalesContractRows
                        label={view.label}
                        empty={view.rowsLabels.empty}
                        editLabel={view.editLabel}
                        rows={rows}
                        isLoading={isLoading}
                        onEdit={on.edit}
                    />
                )}
            />
        </SalesContractsBody>
    )
}
const SalesPanel = (props: SalesWorkbenchBaseProps) => {
    const view = props.props
    switch (props.shape) {
        case "attention":
            return <SalesAttentionRows {...view.attention} on={props.on.attention} />
        case "pipeline":
            return <SalesPipelineBoard {...view.pipeline} on={props.on.pipeline} />
        case "decisions":
            return <SalesDecisionsBody {...view.decisions} on={props.on.decisions} />
        case "handoff":
            return (
                <>
                    <SalesHandoffsBody {...view.handoffs} on={props.on.handoffs} />
                    <Orders props={props.props} on={props.on} />
                </>
            )
        case "contracts":
            return <Contracts props={props.props} on={props.on} />
        case "activity":
            return (
                <Stack gap="row">
                    <Text size="sm" tone="muted">
                        {view.activity.intro}
                    </Text>
                    <SalesActivityRows {...view.activity} isLoading={false} />
                </Stack>
            )
        case "conversation":
        case "explanation":
            return null
    }
}
const ModulePanel = (props: SalesWorkbenchBaseProps) => {
    switch (props.shape) {
        case "conversation":
            return <Inbox props={props.props} on={props.on} />
        case "attention":
        case "pipeline":
        case "decisions":
        case "handoff":
        case "contracts":
        case "activity":
        case "explanation":
            return (
                <SlotView
                    {...props.props.gate}
                    onRetry={props.on.retry}
                    render={(_, isLoading) => (
                        <GateBody
                            isLoading={isLoading}
                            name={props.props.gate.name}
                            content={<SalesPanel {...props} />}
                        />
                    )}
                />
            )
    }
}
const WaitingCard = (props: Omit<SalesWorkbenchBaseProps, "shape">) => (
    <SlotView
        {...props.props.waiting}
        empty="collapse"
        onRetry={props.on.waiting.retry}
        render={(rows, isLoading) => (
            <WorkbenchWaitingList
                {...props.props.waiting.list}
                surface="card"
                items={rows.map((row) => ({ row }))}
                isSkeleton={isLoading}
                onCommand={props.on.waiting.command}
            />
        )}
    />
)
const DashboardCards = (props: Omit<SalesWorkbenchBaseProps, "shape">) => {
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
const Overview = (props: SalesWorkbenchBaseProps) => {
    const view = props.props
    return (
        <Stack gap="region">
            <WaitingCard props={props.props} on={props.on} />
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
const Explanation = (props: Omit<SalesWorkbenchBaseProps, "shape">) => {
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
/** Each actual product drawing remains a pure composition of resolved data and native commands. */
export const SalesWorkbenchBase = (props: SalesWorkbenchBaseProps) => {
    switch (props.shape) {
        case "attention":
        case "pipeline":
        case "decisions":
        case "handoff":
        case "contracts":
        case "activity":
        case "conversation":
            return <Overview {...props} />
        case "explanation":
            return <Explanation props={props.props} on={props.on} />
    }
}
