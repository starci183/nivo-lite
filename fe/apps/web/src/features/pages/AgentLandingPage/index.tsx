import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { isModuleKey } from "@/modules/catalog"
import { AgentLandingPageBase } from "./component"

/** What the route hands the page: the type and the instance of the url. */
type AgentLandingPageProps = {
    readonly module: string
    readonly installationId: string
}

/** The document title of the landing: the agents area, until the tab it leaves for names itself. */
export const agentLandingMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("modulesCore")
    return { title: t("catalogTitle") }
}

/** The landing of one instance: the block leaves for the tab the agent opens on once the browser knows its state. */
export const AgentLandingPage = (props: AgentLandingPageProps): ReactElement => {
    if (!isModuleKey(props.module)) notFound()
    return <AgentLandingPageBase props={{ module: props.module, installationId: props.installationId }} />
}
