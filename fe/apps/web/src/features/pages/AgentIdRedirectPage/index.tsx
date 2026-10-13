import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { AgentIdRedirect } from "@/components/blocks/AgentIdRedirect"

/** What the route hands the page: the agent id of the old url. */
interface AgentIdRedirectPageProps {
    readonly agentId: string
}

/** The document title while the old url moves on: the agent catalogue. */
export const agentIdRedirectMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("modulesCore")
    return { title: t("catalogTitle") }
}

/** The setup url of an agent before agents became instances: it moves to the instance that owns the agent. */
export const AgentIdRedirectPage = (props: AgentIdRedirectPageProps) => <AgentIdRedirect agentId={props.agentId} />
