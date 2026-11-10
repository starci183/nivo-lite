import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { isModuleKey } from "@/modules/catalog"
import { AgentRunPageBase } from "./component"

/** What the route hands the page: the type, the instance and the run of the url. */
type AgentRunPageProps = {
    readonly module: string
    readonly installationId: string
    readonly runId: string
}

/** The document title of the page of a run. */
export const agentRunMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("agentRuns")
    return { title: t("runPaneLabel") }
}

/** The page of one run of an agent: the panes read the run in the browser; the page knows only the type. */
export const AgentRunPage = (props: AgentRunPageProps) => {
    if (!isModuleKey(props.module)) notFound()
    return (
        <AgentRunPageBase props={{ module: props.module, installationId: props.installationId, runId: props.runId }} />
    )
}
