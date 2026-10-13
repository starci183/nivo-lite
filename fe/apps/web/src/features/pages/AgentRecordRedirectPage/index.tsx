import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { AgentRecordRedirectPageBase } from "./component"

/** The document title of an old agent url while it is redirected. */
export const agentRecordRedirectMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("modulesCore")
    return { title: t("catalogTitle") }
}

/** What the route hands the page: the agent id of the old url. */
type AgentRecordRedirectPageProps = {
    readonly agentId: string
}

/** The url of an agent before agents became instances: the connected block leads to its instance, else its type. */
export const AgentRecordRedirectPage = (props: AgentRecordRedirectPageProps) => (
    <AgentRecordRedirectPageBase props={{ agentId: props.agentId }} />
)
