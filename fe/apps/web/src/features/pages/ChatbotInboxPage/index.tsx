import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { ChatbotInboxPageBase } from "./component"

/** The document title of the inbox tab. */
export const chatbotInboxMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("modulesCore")
    return { title: t("tab_inbox") }
}

/** What the route hands the inbox: the type and the instance of the url and the conversation to open. */
interface ChatbotInboxPageProps {
    readonly module: string
    readonly installationId: string
    /** `?focus=` of the route: the conversation to open. */
    readonly focus: string | null
}

/** /agents/chatbot/<installation>/inbox: only the Chatbot has an inbox; every panel reads its own data. */
export const ChatbotInboxPage = (props: ChatbotInboxPageProps) => {
    if (props.module !== "chatbot") notFound()
    return <ChatbotInboxPageBase props={{ installationId: props.installationId, focus: props.focus }} />
}
