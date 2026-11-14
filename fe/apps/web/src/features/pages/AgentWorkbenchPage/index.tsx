import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import type { ReactElement } from "react"
import { SpecWorkbenchFrame } from "@/components/blocks/SpecWorkbenchFrame"
import { isModuleKey } from "@/modules/catalog"
import { agentHref } from "@/modules/installations"
import { workspaceHref } from "@/modules/routes"
import { workbenchSpec } from "@/modules/workbench-spec"
import { AgentWorkbenchPageBase } from "./component"
import { AgentWorkbenchLoadingBody } from "./LoadingBody"

/** The document title of the workbench tab. */
export const agentWorkbenchMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("modulesCore")
    return { title: t("tab_workbench") }
}

/** What the route hands the page: the type and the instance of the url and the deep link of the query. */
type AgentWorkbenchPageProps = {
    /** The workspace of the url. */
    readonly workspaceId: string
    readonly module: string
    readonly installationId: string
    /** The `tab` of the query: the workbench area to open (the agent dashboard frame validates it). */
    readonly tab: string | null
}

/** The workbench slot of one instance: the spec of the module drawn on the installation of the url, else the pending state. */
export const AgentWorkbenchPage = async (props: AgentWorkbenchPageProps): Promise<ReactElement> => {
    if (!isModuleKey(props.module)) notFound()
    const resolved = workbenchSpec(props.module)
    if (resolved !== null)
        return (
            <SpecWorkbenchFrame
                module={props.module}
                installationId={props.installationId}
                spec={resolved.spec}
                fallback={resolved.fallback}
                tab={props.tab}
            />
        )
    const t = await getTranslations("modulesCore")
    return (
        <AgentWorkbenchPageBase
            props={{
                title: t("workbenchTitle"),
                body: t("workbenchBody"),
                setupLabel: t("workbenchSetup"),
                setupHref: workspaceHref(props.workspaceId, agentHref(props.module, props.installationId)),
            }}
        />
    )
}

/** The workbench while its route loads: the words of every layout are translated here, the browser's address picks the layout of the agent type. */
export const AgentWorkbenchLoadingPage = async (): Promise<ReactElement> => {
    const modules = await getTranslations("modulesCore")
    return (
        <AgentWorkbenchLoadingBody
            words={{
                pending: { title: modules("workbenchTitle"), body: modules("workbenchBody"), setupLabel: modules("workbenchSetup") },
            }}
        />
    )
}
