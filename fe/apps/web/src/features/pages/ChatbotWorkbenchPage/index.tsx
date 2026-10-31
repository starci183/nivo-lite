import { getTranslations } from "next-intl/server"
import { ChatbotWorkbenchPageBase } from "./component"

/** What the agent workbench route hands the Chatbot workbench. */
interface ChatbotWorkbenchPageProps {
    /** `?focus=` of the route: the conversation to open. */
    readonly focus?: string | null
    /** The Chatbot instance the workbench opens for. */
    readonly installationId?: string
    /** `?tab=` of the route: inbox, customers or gaps. */
    readonly tab?: string | null
}

/** /agents/chatbot/workbench: the server shell words the inbox and hands the page the ids; every panel reads its own data. */
export const ChatbotWorkbenchPage = async (props: ChatbotWorkbenchPageProps) => {
    const t = await getTranslations("workbenchChatbot")
    return (
        <ChatbotWorkbenchPageBase
            props={{
                installationId: props.installationId ?? null,
                focus: props.focus ?? null,
                inboxLabel: t("title"),
                tab: props.tab ?? null,
                customersLabel: t("tabCustomers"),
                gapsLabel: t("tabGaps"),
            }}
        />
    )
}
