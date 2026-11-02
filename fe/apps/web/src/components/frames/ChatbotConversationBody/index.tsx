import type { ChatbotConversationView, ChatbotInboxActions } from "@/modules/types"
import { ChatbotConversationList } from "@/components/composites/ChatbotConversationList"
import { ChatbotInboxPanel } from "@/components/composites/ChatbotInboxPanel"
import { ChatbotSidePanel } from "@/components/composites/ChatbotSidePanel"
import { ChatbotThreadView } from "@/components/composites/ChatbotThreadView"
interface ChatbotConversationBodyProps extends ChatbotConversationView {
    readonly isLoading: boolean
    readonly on: ChatbotInboxActions
}
/** Draws the same list, thread and customer side pane for both Sales and Chatbot, without reading their world. */
export const ChatbotConversationBody = (props: ChatbotConversationBodyProps) => (
    <ChatbotInboxPanel
        title={props.title}
        actionFailedTitle={props.actionFailedTitle}
        actionError={props.actionError}
        pane={props.pane}
        hasSelection={props.hasSelection}
        pickTitle={props.pickTitle}
        pickBody={props.pickBody}
        sideLabel={props.sideLabel}
        closeSideLabel={props.closeSideLabel}
        isInfoOpen={props.isInfoOpen}
        isSkeleton={props.isLoading}
        onInfoOpenChange={(isOpen) => {
            if (isOpen !== props.isInfoOpen) props.on.toggleInfo()
        }}
        list={
            <ChatbotConversationList
                {...props.list}
                isSkeleton={props.isLoading}
                onQuery={props.on.query}
                onFilter={props.on.filter}
                onSelect={props.on.select}
            />
        }
        thread={
            <ChatbotThreadView
                {...props.thread}
                onBack={props.on.back}
                onToggleInfo={props.on.toggleInfo}
                onDraft={props.on.draft}
                onSend={props.on.send}
            />
        }
        side={
            <ChatbotSidePanel
                {...props.side}
                onClose={props.on.toggleInfo}
                onToggleHandling={props.on.toggleHandling}
                onEscalationDraft={props.on.escalationDraft}
                onSendAnswer={props.on.sendAnswer}
                onDeclineAnswer={props.on.declineAnswer}
            />
        }
    />
)
