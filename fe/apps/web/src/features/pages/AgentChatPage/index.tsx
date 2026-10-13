import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { readAgent } from "@/modules/db"
import { readFoundingMember } from "@/modules/db/promo/read-founding-member"
import { readActiveWorkspace } from "@/modules/db/workspace/read-active-workspace"
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

/** Agent chat: the owner's test conversation and the simulated customer channel (`?tab=customer`), read and written under the member's RLS. */
export const AgentChatPage = async (props: AgentChatPageProps) => {
    const [agent, workspace] = await Promise.all([readAgent(props.agentId), readActiveWorkspace()])
    if (agent.kind === "not-found") notFound()
    if (agent.kind !== "ok") throw new Error(`agent-chat: ${agent.kind} ${agent.code}`)
    const founding = props.welcome === "1" && agent.value.module === "chatbot" ? await readFoundingMember() : null
    return (
        <AgentChatPageBase
            props={{
                agent: {
                    id: agent.value.id,
                    module: agent.value.module,
                    name: agent.value.name,
                    handle: agent.value.handle,
                    role: agent.value.role,
                    isActive: agent.value.status === "active",
                    hasCustomerChannel: agent.value.module === "chatbot",
                },
                workspaceId: workspace.kind === "ok" ? workspace.value.id : null,
                initialTab: props.tab === "customer" ? "customer" : "test",
                initialConversationId: props.conversationId ?? null,
                showWelcome: founding !== null && founding.kind === "ok" && founding.value,
            }}
        />
    )
}
