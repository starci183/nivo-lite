import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import type { ReactElement } from "react"
import { AgentDataBody } from "@/components/blocks/AgentDataBody"
import { isModuleKey } from "@/modules/catalog"
import { AgentDataLoadingBody } from "./LoadingBody"

/** The document title of a data page: the desk it belongs to (the set's own title is drawn by its view). */
export const agentDataMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("modulesCore")
    return { title: t("tab_workbench") }
}

/** What the route hands the page: the workspace, the type, the instance and the set of the url. */
type AgentDataPageProps = {
    readonly workspaceId: string
    readonly module: string
    readonly installationId: string
    readonly set: string
}

/** The data page of one set of one agent instance: the view `data-<set>` of the module's spec, which reads the provider in the browser. */
export const AgentDataPage = (props: AgentDataPageProps): ReactElement => {
    if (!isModuleKey(props.module)) notFound()
    return (
        <AgentDataBody
            workspaceId={props.workspaceId}
            module={props.module}
            installationId={props.installationId}
            set={props.set}
        />
    )
}

/** The data page while its route loads: the view reads the type, the instance and the set from the address and draws its own skeletons. */
export const AgentDataLoadingPage = (): ReactElement => <AgentDataLoadingBody />
