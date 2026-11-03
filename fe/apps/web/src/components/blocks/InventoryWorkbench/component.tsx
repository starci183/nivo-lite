import type { ReactElement } from "react"
import { type InventoryWorkbenchDataView, type InventoryWorkbenchActions, INVENTORY_TABS } from "@/modules/types"
import { Grid, Stack, Tabs } from "@starci/grammar/common"
import { ConnectionsRegion } from "@/components/composites/ConnectionsRegion"
import { DoneRegion } from "@/components/composites/DoneRegion"
import { FiguresStrip } from "@/components/composites/FiguresStrip"
import { KnowledgeRegion } from "@/components/composites/KnowledgeRegion"
import { WaitingRegion } from "@/components/composites/WaitingRegion"
import { WorkbenchPaneRows } from "@/components/composites/WorkbenchPaneRows"
import { WorkbenchWhyFrame } from "@/components/frames/WorkbenchWhyFrame"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { InventoryStock } from "@/components/frames/InventoryStock"
import { InventoryOrders } from "@/components/frames/InventoryOrders"
import { InventorySuppliers } from "@/components/frames/InventorySuppliers"
import { InventoryRecipes } from "@/components/frames/InventoryRecipes"
import { InventoryPending } from "@/components/composites/InventoryPending"
import { InventoryHistory } from "@/components/composites/InventoryHistory"
import { InventoryCount } from "@/components/composites/InventoryCount"
import { InventoryImport } from "@/components/composites/InventoryImport"
/** The seven original Inventory panels and the recorded-explanation arrangement. */
export const INVENTORY_WORKBENCH_SHAPES: readonly [...typeof INVENTORY_TABS, "explanation"] = [
    ...INVENTORY_TABS,
    "explanation",
]
type InventoryWorkbenchShape = (typeof INVENTORY_WORKBENCH_SHAPES)[number]
/** Plain inventory models and commands; only this module Base draws their read status. */
export interface InventoryWorkbenchBaseProps {
    readonly shape: InventoryWorkbenchShape
    readonly props: InventoryWorkbenchDataView
    readonly on: InventoryWorkbenchActions
}
const panelId = (id: string): string => `agent-dashboard-panel-${id}`
const ModulePanel = (props: InventoryWorkbenchBaseProps) => {
    if (props.shape === "import")
        return (
            <SlotView
                {...props.props.importPanel}
                onRetry={props.on.retryImport}
                render={(view, isLoading) => <InventoryImport {...view} {...props.on.imports} isLoading={isLoading} />}
            />
        )
    return (
        <SlotView
            {...props.props.panel}
            onRetry={props.on.retryPanel}
            render={(panel, isLoading) => {
                switch (props.shape) {
                    case "stock":
                        return <InventoryStock {...panel.stock} {...props.on.stock} isLoading={isLoading} />
                    case "orders":
                        return (
                            <Stack gap="row">
                                <InventoryPending {...panel.pending} {...props.on.pending} isLoading={isLoading} />
                                <InventoryOrders {...panel.orders} {...props.on.orders} isLoading={isLoading} />
                            </Stack>
                        )
                    case "suppliers":
                        return <InventorySuppliers {...panel.suppliers} {...props.on.suppliers} isLoading={isLoading} />
                    case "history":
                        return <InventoryHistory {...panel.history} {...props.on.history} isLoading={isLoading} />
                    case "recipes":
                        return <InventoryRecipes {...panel.recipes} {...props.on.recipes} isLoading={isLoading} />
                    case "count":
                        return <InventoryCount {...panel.count} {...props.on.count} isLoading={isLoading} />
                    case "import":
                    case "explanation":
                        return null
                }
            }}
        />
    )
}

const DashboardCards = (props: Omit<InventoryWorkbenchBaseProps, "shape">) => {
    const regions = props.props.regions
    return (
        <Grid kind="cards" columns={3}>
            <SlotView
                {...regions.done}
                onRetry={props.on.retryDashboard}
                render={(view, isLoading) => (
                    <DoneRegion label={regions.done.label} view={view} isLoading={isLoading} />
                )}
            />
            <SlotView
                {...regions.connections}
                onRetry={props.on.retryDashboard}
                render={(view, isLoading) => (
                    <ConnectionsRegion label={regions.connections.label} view={view} isLoading={isLoading} />
                )}
            />
            <SlotView
                {...regions.knowledge}
                onRetry={props.on.retryDashboard}
                render={(view, isLoading) => (
                    <KnowledgeRegion label={regions.knowledge.label} view={view} isLoading={isLoading} />
                )}
            />
        </Grid>
    )
}

const Overview = (props: InventoryWorkbenchBaseProps) => {
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
                forbidden="notice"
                onRetry={props.on.retryPanel}
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

const Explanation = (props: Omit<InventoryWorkbenchBaseProps, "shape">) => {
    const view = props.props,
        why = view.why
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
} /** Draws the actual inventory panels and original overview/why layouts; status never becomes a shape. */
export const InventoryWorkbenchBase = (props: InventoryWorkbenchBaseProps): ReactElement => {
    switch (props.shape) {
        case "stock":
        case "orders":
        case "suppliers":
        case "history":
        case "recipes":
        case "count":
        case "import":
            return <Overview {...props} />
        case "explanation":
            return <Explanation props={props.props} on={props.on} />
    }
}
