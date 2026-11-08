import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { agentWorkViewOf, type AgentWorkViewKey } from "@/modules/agentWork"
import { isModuleKey } from "@/modules/catalog"
import { workbenchSpec } from "@/modules/workbench-spec"
import { AgentWorkPageBase } from "./component"

/** What the route hands the page: the type and the instance of the url. */
type AgentWorkPageProps = {
    readonly module: string
    readonly installationId: string
    /** The query of the url: the view, a run and a status filter. */
    readonly query: Readonly<Record<string, string | undefined>>
}

/** The document title of the work tab. */
export const agentWorkMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("modulesCore")
    return { title: t("tab_work") }
}

/** The work tab of one instance: the panes read the instance in the browser; the page knows only the type. */
export const AgentWorkPage = (props: AgentWorkPageProps) => {
    const runs = workbenchSpec("platform")
    if (!isModuleKey(props.module) || runs === null) notFound()
    const view: AgentWorkViewKey = agentWorkViewOf((name) => props.query[name])
    return (
        <AgentWorkPageBase
            props={{ module: props.module, installationId: props.installationId, view, runsSpec: runs.spec }}
        />
    )
}
