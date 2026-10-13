import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { MODULE_REGISTRY, isModuleKey, pickCopy } from "@/modules/catalog"
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
export const AgentSetupPage = async (props: AgentSetupPageProps) => {
    if (!isModuleKey(props.module)) notFound()
    const locale = (await getLocale()) === "en" ? "en" : "vi"
    return (
        <AgentSetupPageBase
            props={{
                module: props.module,
                installationId: props.installationId,
                typeName: pickCopy(MODULE_REGISTRY[props.module].shortName, locale),
            }}
        />
    )
}
