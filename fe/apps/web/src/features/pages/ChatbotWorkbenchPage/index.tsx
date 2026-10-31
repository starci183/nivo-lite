import { ChatbotWorkbenchPageBase } from "./component"

/** What the agent workbench route hands the Chatbot workbench. */
interface ChatbotWorkbenchPageProps {
    /** The Chatbot instance the workbench opens for. */
    readonly installationId?: string
}

/** /agents/chatbot/workbench: hands the page the instance; every panel reads its own data. */
export const ChatbotWorkbenchPage = (props: ChatbotWorkbenchPageProps) => (
    <ChatbotWorkbenchPageBase props={{ installationId: props.installationId ?? null }} />
)
