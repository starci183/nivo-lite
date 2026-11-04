import type { ReactElement } from "react"
import type { ChatbotWorkbenchActions, ChatbotWorkbenchViewData } from "@/modules/types"
import { WorkbenchPaneRows } from "@/components/composites/WorkbenchPaneRows"
import { WorkbenchWaitingList } from "@/components/composites/WorkbenchWaitingList"
import { WorkbenchWhyFrame } from "@/components/frames/WorkbenchWhyFrame"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { ChatbotReplyEditor } from "@/components/branches/ChatbotReplyEditor"
import { ChatbotCustomerRows } from "@/components/composites/ChatbotCustomerRows"
import { ChatbotGapRows } from "@/components/composites/ChatbotGapRows"
import { CHATBOT_WORKBENCH_TABS as CHATBOT_TABS } from "@/modules/types"
import { ChatbotInboxSlot } from "@/components/frames/ChatbotConversationBody"
import { WorkbenchOverview } from "@/components/frames/WorkbenchOverview"
/** The actual Chatbot list, conversation, gaps and explanation drawings. */
export const CHATBOT_WORKBENCH_SHAPES: readonly [...typeof CHATBOT_TABS, "conversation", "explanation"] = [
    ...CHATBOT_TABS,
    "conversation",
    "explanation",
]
type ChatbotWorkbenchShape = (typeof CHATBOT_WORKBENCH_SHAPES)[number]
/** Supplies the selected drawing, resolved workbench data, and customer actions. */
export interface ChatbotWorkbenchBaseProps {
    readonly shape: ChatbotWorkbenchShape
    readonly props: ChatbotWorkbenchViewData
    readonly on: ChatbotWorkbenchActions
}
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
            return <ChatbotInboxSlot inbox={props.props.inbox} on={props.on.inbox} />
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
const Overview = (props: ChatbotWorkbenchBaseProps) => (
    <WorkbenchOverview
        view={props.props}
        ribbon={props.props.ribbon}
        on={{ ...props.on, retryRibbon: props.on.retry }}
        waiting={<WaitingCard props={props.props} on={props.on} />}
    >
        <ModulePanel {...props} />
    </WorkbenchOverview>
)
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
export const ChatbotWorkbenchBase = (props: ChatbotWorkbenchBaseProps): ReactElement => {
    switch (props.shape) {
        case "customers":
        case "gaps":
        case "conversation":
            return <Overview {...props} />
        case "explanation":
            return <Explanation props={props.props} on={props.on} />
    }
}
