import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { AgentProfilePageBase } from "./component"

/** What the route hands the page: the agent of the url. */
type AgentProfilePageProps = {
    readonly agentId: string
}

/** The document title of the agent profile. */
export const agentProfileMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("agentProfile")
    return { title: t("title") }
}

/** The agent profile route: a shell that mounts the connected cards, which read the agent in the browser. */
export const AgentProfilePage = (props: AgentProfilePageProps) => (
    <AgentProfilePageBase props={{ agentId: props.agentId }} />
)
