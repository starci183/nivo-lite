import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { isModuleKey } from "@/modules/catalog"
import { navigation } from "@/modules/i18n"
import { workflowsHref } from "@/modules/installations"
import { workspaceHref } from "@/modules/routes"

/** What the old address carried: the workspace, the type and the instance of the url, and the workflow when it named one. */
type AgentWorkflowsMovedPageProps = {
    readonly workspaceId: string
    readonly module: string
    readonly installationId: string
    readonly workflow?: string
}

/** The document title while the old address is forwarded. */
export const agentWorkflowsMovedMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("modulesCore")
    return { title: t("tab_workflows") }
}

/** Moved: the workflows are their own tab of the agent, so the old Setup address forwards there. */
export const AgentWorkflowsMovedPage = async (props: AgentWorkflowsMovedPageProps): Promise<ReactElement> => {
    if (!isModuleKey(props.module)) notFound()
    return navigation.redirect({
        href: workspaceHref(props.workspaceId, workflowsHref(props.module, props.installationId, props.workflow)),
        locale: (await getLocale()) === "en" ? "en" : "vi",
    })
}
