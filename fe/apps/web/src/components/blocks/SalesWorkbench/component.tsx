import type { ReactElement } from "react"
import type { SalesWorkbenchViewData, SalesWorkbenchActions } from "@/modules/types"
import { Button, Stack, Text } from "@starci/grammar/common"
import { WorkbenchWaitingList } from "@/components/composites/WorkbenchWaitingList"
import { WorkbenchWhyDecision } from "@/components/composites/WorkbenchWhyDecision"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { SalesContractsBody } from "@/components/frames/SalesContractsBody"
import { SalesDecisionsBody } from "@/components/frames/SalesDecisionsBody"
import { SalesHandoffsBody } from "@/components/frames/SalesHandoffsBody"
import { GateBody } from "@/components/composites/GateBody"
import { SalesActivityRows } from "@/components/composites/SalesActivityRows"
import { SalesAttentionRows } from "@/components/composites/SalesAttentionRows"
import { SalesContractRows } from "@/components/composites/SalesContractRows"
import { SalesOrderRows } from "@/components/composites/SalesOrderRows"
import { SalesPipelineBoard } from "@/components/composites/SalesPipelineBoard"
import { SALES_WORKBENCH_TABS } from "@/modules/types"
import { ChatbotInboxSlot } from "@/components/frames/ChatbotConversationBody"
import { WorkbenchOverview } from "@/components/frames/WorkbenchOverview"
/** The six Sales areas and the optional customer conversation, each a tab of the one workbench. */
type SalesArea = (typeof SALES_WORKBENCH_TABS)[number] | "conversation"
interface SalesWorkbenchBaseProps {
    readonly shape: SalesArea
    readonly props: SalesWorkbenchViewData
    readonly on: SalesWorkbenchActions
}
/** What a panel of one tab reads: the view and the commands of the desk. */
type PanelProps = Pick<SalesWorkbenchBaseProps, "props" | "on">
const Orders = (props: PanelProps) => {
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
const Contracts = (props: PanelProps) => {
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
            return null
    }
}
const ModulePanel = (props: SalesWorkbenchBaseProps) => {
    switch (props.shape) {
        case "conversation":
            return <ChatbotInboxSlot inbox={props.props.inbox} on={props.on.inbox} />
        case "attention":
        case "pipeline":
        case "decisions":
        case "handoff":
        case "contracts":
        case "activity":
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
const WaitingRows = (props: PanelProps) => (
    <SlotView
        {...props.props.waiting}
        empty="collapse"
        onRetry={props.on.waiting.retry}
        render={(rows, isLoading) => (
            <WorkbenchWaitingList
                {...props.props.waiting.list}
                surface="pane"
                items={rows.map((row) => ({ row }))}
                isSkeleton={isLoading}
                onCommand={props.on.waiting.command}
            />
        )}
    />
)
/** The decision the explanation is about, with the same commands its row has. */
const WhyDecision = (props: PanelProps) => {
    const slot = props.props.waiting.slot
    const row = "items" in slot ? slot.items.find((item) => item.id === props.props.why.workItemId) : undefined
    return <WorkbenchWhyDecision row={row} onCommand={props.on.waiting.command} />
}
/** The Sales workbench: the tabs and the chosen tab's panel beside the decisions, or beside the explanation of one. */
export const SalesWorkbenchBase = (props: SalesWorkbenchBaseProps): ReactElement => (
    <WorkbenchOverview
        view={props.props}
        ribbon={props.props.ribbon}
        on={{ ...props.on, retryRibbon: props.on.retry }}
        aside={{ view: props.props.aside, on: props.on.aside }}
        waiting={<WaitingRows props={props.props} on={props.on} />}
        whyDecision={<WhyDecision props={props.props} on={props.on} />}
    >
        <ModulePanel {...props} />
    </WorkbenchOverview>
)
