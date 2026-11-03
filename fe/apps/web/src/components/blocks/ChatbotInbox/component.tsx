import type { ChatbotConversationView, ChatbotInboxActions, SlotPanelProps } from "@/modules/types"
import { ChatbotConversationBody } from "@/components/frames/ChatbotConversationBody"
import { SlotView } from "@nivo/agent-sdk/workbench"
/** Supplies the conversation read and retry action to the standalone inbox. */
export interface ChatbotInboxBaseProps {
    readonly props: SlotPanelProps<ChatbotConversationView>
    readonly on: ChatbotInboxActions & {
        readonly reload: () => void
    }
}
/** The live standalone inbox page reuses the same actual three-pane customer drawing as the two workbenches. */
export const ChatbotInboxBase = (props: ChatbotInboxBaseProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder={props.props.placeholder}
        labels={props.props.labels}
        onRetry={props.on.reload}
        render={(inbox, isLoading) => <ChatbotConversationBody {...inbox} isLoading={isLoading} on={props.on} />}
    />
)
