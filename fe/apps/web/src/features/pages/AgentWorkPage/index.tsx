import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { isModuleKey } from "@/modules/catalog"
import { AgentWorkPageBase } from "./component"

/** What the route hands the page: the type and the instance of the url. */
type AgentWorkPageProps = {
    readonly module: string
    readonly installationId: string
}

/** The document title of the work tab. */
export const agentWorkMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("modulesCore")
    return { title: t("tab_work") }
}

/** The work tab of one instance: the panes read the instance in the browser; the page knows only the type. */
export const AgentWorkPage = (props: AgentWorkPageProps) => {
    if (!isModuleKey(props.module)) notFound()
    return <AgentWorkPageBase props={{ module: props.module, installationId: props.installationId }} />
}
