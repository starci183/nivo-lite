import type { ReactElement } from "react"
import type { ChatbotWorkbenchActions, ChatbotWorkbenchViewData } from "@/modules/types"
import { WorkbenchWaitingList } from "@/components/composites/WorkbenchWaitingList"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { ChatbotReplyEditor } from "@/components/branches/ChatbotReplyEditor"
import { ChatbotCustomerRows } from "@/components/composites/ChatbotCustomerRows"
import { ChatbotGapRows } from "@/components/composites/ChatbotGapRows"
import { ChatbotInboxSlot } from "@/components/frames/ChatbotConversationBody"
import { WorkbenchOverview } from "@/components/frames/WorkbenchOverview"
/** The two areas of the Chatbot workbench and the conversation of an opened customer. */
type ChatbotWorkbenchShape = "customers" | "gaps" | "conversation"
/** Supplies the selected drawing, resolved workbench data, and customer actions. */
export interface ChatbotWorkbenchBaseProps {
    readonly shape: ChatbotWorkbenchShape
    readonly props: ChatbotWorkbenchViewData
    readonly on: ChatbotWorkbenchActions
}
/** What a part of the desk reads: the view and the commands. */
type PanelProps = Pick<ChatbotWorkbenchBaseProps, "props" | "on">
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
    }
}
const WaitingCard = (props: PanelProps) => {
    const view = props.props.waiting
    const edit = view.edit
    return (
        <SlotView
            {...view}
            emptyDescription={view.list.emptyDescription}
            onRetry={props.on.waiting.retry}
            render={(rows, isLoading) => (
                <WorkbenchWaitingList
                    {...view.list}
                    surface="pane"
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
/** The Chatbot workbench: the tabs and the chosen area beside the decisions, or beside the explanation of one. */
export const ChatbotWorkbenchBase = (props: ChatbotWorkbenchBaseProps): ReactElement => (
    <WorkbenchOverview
        view={props.props}
        ribbon={props.props.ribbon}
        on={{ ...props.on, retryRibbon: props.on.retry }}
        aside={{ view: props.props.aside, on: props.on.aside }}
        waiting={<WaitingCard props={props.props} on={props.on} />}
        decisions={{ slot: props.props.waiting.slot, onCommand: props.on.waiting.command }}
    >
        <ModulePanel {...props} />
    </WorkbenchOverview>
)
