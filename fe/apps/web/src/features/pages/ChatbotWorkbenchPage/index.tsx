import { getTranslations } from "next-intl/server"
import { ChatbotWorkbenchPageBase } from "./component"

/** What the agent workbench route hands the Chatbot workbench. */
interface ChatbotWorkbenchPageProps {
    /** The Chatbot instance the workbench opens for. */
    readonly installationId?: string
    /** `?tab=` of the route: customers or gaps. */
    readonly tab?: string | null
    /** `?focus=` of the route: the conversation of a customer to open. */
    readonly focus?: string | null
}

/** /agents/chatbot/workbench: the server shell words the tabs and hands the page the ids; every panel reads its own data. */
export const ChatbotWorkbenchPage = async (props: ChatbotWorkbenchPageProps) => {
    const t = await getTranslations("workbenchChatbot")
    return (
        <ChatbotWorkbenchPageBase
            props={{
                installationId: props.installationId ?? null,
                tab: props.tab ?? null,
                focus: props.focus ?? null,
                customersLabel: t("tabCustomers"),
                gapsLabel: t("tabGaps"),
            }}
        />
    )
}
