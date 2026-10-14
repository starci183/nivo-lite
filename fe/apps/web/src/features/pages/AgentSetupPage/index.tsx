import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { isModuleKey } from "@/modules/catalog"
import { AgentSetupPageBase } from "./component"

/** What the route hands the page: the type and the instance of the url. */
type AgentSetupPageProps = {
    readonly module: string
    readonly installationId: string
}

/** The document title of the setup tab. */
export const agentSetupMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("modulesCore")
    return { title: t("tab_setup") }
}

/** The Setup tab of one instance: the connected blocks read the chat, the draft, the checklist and the versions in the browser. */
export const AgentSetupPage = (props: AgentSetupPageProps) => {
    if (!isModuleKey(props.module)) notFound()
    return (
        <AgentSetupPageBase
            props={{
                module: props.module,
                installationId: props.installationId,
            }}
        />
    )
}
