import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { isModuleKey } from "@/modules/catalog"
import { navigation } from "@/modules/i18n"
import { setupGeneralHref } from "@/modules/installations"
import { workspaceHref } from "@/modules/routes"

/** What the old settings address carried: the workspace, the type and the instance of the url. */
type AgentSettingsPageProps = {
    readonly workspaceId: string
    readonly module: string
    readonly installationId: string
}

/** The document title while the old settings address is forwarded. */
export const agentSettingsMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("modulesCore")
    return { title: t("tab_setup") }
}

/** Moved: the settings of an agent are the "Chung" section of Setup, so the old address forwards there. */
export const AgentSettingsPage = async (props: AgentSettingsPageProps): Promise<ReactElement> => {
    if (!isModuleKey(props.module)) notFound()
    return navigation.redirect({
        href: workspaceHref(props.workspaceId, setupGeneralHref(props.module, props.installationId)),
        locale: (await getLocale()) === "en" ? "en" : "vi",
    })
}
