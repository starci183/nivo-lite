import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"
import { MODULE_REGISTRY, isModuleKey } from "@/modules/catalog"
import { agentHref } from "@/modules/installations"
import { AgentWorkbenchPageBase } from "./component"

/** The document title of the workbench tab. */
export const agentWorkbenchMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("modulesCore")
    return { title: t("tab_workbench") }
}

/** What the route hands the page: the type and the instance of the url and the deep link of the query. */
type AgentWorkbenchPageProps = {
    readonly module: string
    readonly installationId: string
    /** The `tab` of the query: the workbench area to open (the agent dashboard frame validates it). */
    readonly tab: string | null
    /** The `focus` of the query: the record a waiting row leads to. */
    readonly focus: string | null
    /** The `conversation` of the query: the thread of a customer a desk draws beside its areas. */
    readonly conversation?: string | null
    /** The workbench of each module by the workbench key of its catalogue entry; the route registers them. A module without one shows the pending state. */
    readonly workbenches: Readonly<Record<string, WorkbenchComponent>>
}

/**
 * A workbench receives the tab, the focus and the id of the installation it is opened for (it reads its own data in the browser); a
 * multi-instance type scopes its data to that installation, a single-instance type may ignore it.
 */
export type WorkbenchComponent = (props: Record<string, unknown>) => ReactNode | Promise<ReactNode>

/** The workbench slot of one instance: the working screen of the module scoped to the instance, or the pending state. */
export const AgentWorkbenchPage = async (props: AgentWorkbenchPageProps) => {
    if (!isModuleKey(props.module)) notFound()
    const key = MODULE_REGISTRY[props.module].workbench
    const Workbench = key === null ? undefined : props.workbenches[key]
    if (Workbench !== undefined)
        return <Workbench
                tab={props.tab}
                focus={props.focus}
                conversation={props.conversation ?? null}
                installationId={props.installationId}
            />
    const t = await getTranslations("modulesCore")
    return (
        <AgentWorkbenchPageBase
            props={{
                title: t("workbenchTitle"),
                body: t("workbenchBody"),
                setupLabel: t("workbenchSetup"),
                setupHref: agentHref(props.module, props.installationId),
            }}
        />
    )
}
