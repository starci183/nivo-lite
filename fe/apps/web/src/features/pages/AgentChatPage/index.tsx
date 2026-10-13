import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { AgentChatPageBase } from "./component"

/** What the route hands the page: the agent of the url and the query it was opened with. */
interface AgentChatPageProps {
    readonly agentId: string
    readonly tab: string | undefined
    readonly conversationId: string | undefined
    readonly welcome: string | undefined
}

/** The document title of the page. */
export const agentChatMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("agentChat")
    return { title: t("pageLabel") }
}

/** Server shell: the connected chat block loads its data through GraphQL. */
export const AgentChatPage = (props: AgentChatPageProps) => {
    return (
        <AgentChatPageBase
            props={{
                agentId: props.agentId,
                initialTab: props.tab === "customer" ? "customer" : "test",
                initialConversationId: props.conversationId ?? null,
                welcome: props.welcome === "1",
            }}
        />
    )
}
