import type { ChatbotWorkbenchActions, ChatbotWorkbenchViewData } from "@/modules/types"
import { ChatbotConversationBody } from "@/components/frames/ChatbotConversationBody"
import { Grid, Stack, Tabs } from "@starci/grammar/common"
import {
    ConnectionsRegion,
    DoneRegion,
    FiguresStrip,
    KnowledgeRegion,
    SlotView,
    WorkbenchPaneRows,
    WorkbenchWaitingList,
    WorkbenchWhyFrame,
} from "@nivo/agent-sdk/workbench"
import { ChatbotReplyEditor } from "@/components/branches/ChatbotReplyEditor"
import { ChatbotCustomerRows } from "@/components/composites/ChatbotCustomerRows"
import { ChatbotGapRows } from "@/components/composites/ChatbotGapRows"
import { CHATBOT_WORKBENCH_TABS as CHATBOT_TABS } from "@/modules/types"
/** The actual Chatbot list, conversation, gaps and explanation drawings. */
export const CHATBOT_WORKBENCH_SHAPES = [...CHATBOT_TABS, "conversation", "explanation"] as const
type ChatbotWorkbenchShape = (typeof CHATBOT_WORKBENCH_SHAPES)[number]
/** Supplies the selected drawing, resolved workbench data, and customer actions. */
export interface ChatbotWorkbenchBaseProps {
    readonly shape: ChatbotWorkbenchShape
    readonly props: ChatbotWorkbenchViewData
    readonly on: ChatbotWorkbenchActions
}
const panelId = (id: string): string => `agent-dashboard-panel-${id}`
const Inbox = (props: Omit<ChatbotWorkbenchBaseProps, "shape">) => (
    <SlotView
        {...props.props.inbox}
        onRetry={props.on.inbox.reload}
        render={(inbox, isLoading) => <ChatbotConversationBody {...inbox} isLoading={isLoading} on={props.on.inbox} />}
    />
)
const ModulePanel = (props: ChatbotWorkbenchBaseProps) => {
    const view = props.props
    switch (props.shape) {
        case "customers":
            return (
                <SlotView
                    {...view.customers}
                    onRetry={props.on.customers.retry}
                    render={(rows, isLoading) => (
                        <ChatbotCustomerRows
                            words={view.customers.words}
                            rows={rows}
                            query={view.customers.query}
                            filter={view.customers.filter}
                            chips={view.customers.chips}
                            isFull={view.customers.isFull}
                            isLoading={isLoading}
                            onQuery={props.on.customers.query}
                            onFilter={props.on.customers.filter}
                        />
                    )}
                />
            )
        case "conversation":
            return <Inbox props={props.props} on={props.on} />
        case "gaps":
            return !view.gaps.canFill ? null : (
                <SlotView
                    {...view.gaps}
                    onRetry={props.on.gaps.retry}
                    render={(rows, isLoading) => (
                        <ChatbotGapRows
                            title={view.gaps.title}
                            description={view.gaps.description}
                            rows={rows}
                            emptyMessage={view.gaps.labels.empty}
                            isPending={view.gaps.isPending}
                            isLoading={isLoading}
                            onDismiss={props.on.gaps.dismiss}
                        />
                    )}
                />
            )
        case "explanation":
            return null
    }
}
const WaitingCard = (props: Omit<ChatbotWorkbenchBaseProps, "shape">) => {
    const view = props.props.waiting
    const edit = view.edit
    return (
        <SlotView
            {...view}
            empty="collapse"
            onRetry={props.on.waiting.retry}
            render={(rows, isLoading) => (
                <WorkbenchWaitingList
                    {...view.list}
                    surface="card"
                    isSkeleton={isLoading}
                    onCommand={props.on.waiting.command}
                    items={rows.map((row) => ({
                        row,
                        editor:
                            edit !== null && edit.workItemId === row.id ? (
                                <ChatbotReplyEditor
                                    text={edit.text}
                                    label={edit.label}
                                    sendLabel={edit.sendLabel}
                                    cancelLabel={edit.cancelLabel}
                                    isBusy={edit.isBusy}
                                    onDraft={props.on.waiting.changeEdit}
                                    onSend={props.on.waiting.sendEdit}
                                    onCancel={props.on.waiting.cancelEdit}
                                />
                            ) : undefined,
                    }))}
                />
            )}
        />
    )
}
const DashboardCards = (props: Omit<ChatbotWorkbenchBaseProps, "shape">) => {
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
const Overview = (props: ChatbotWorkbenchBaseProps) => {
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
const Explanation = (props: Omit<ChatbotWorkbenchBaseProps, "shape">) => {
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
/** The four real drawings of the Chatbot workbench. */
export const ChatbotWorkbenchBase = (props: ChatbotWorkbenchBaseProps) => {
    switch (props.shape) {
        case "customers":
        case "gaps":
        case "conversation":
            return <Overview {...props} />
        case "explanation":
            return <Explanation props={props.props} on={props.on} />
    }
}
