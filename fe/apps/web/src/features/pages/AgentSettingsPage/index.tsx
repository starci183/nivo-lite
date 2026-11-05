import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { MODULE_REGISTRY, isModuleKey } from "@/modules/catalog"
import { AgentSettingsPageBase } from "./component"

/** The internal agents: they never talk to customers, so their settings have no "answer customers" switch. */
const INTERNAL_MODULES: ReadonlySet<string> = new Set(["sales", "accounting"])

/** What the route hands the page: the type and the instance of the url. */
type AgentSettingsPageProps = {
    readonly module: string
    readonly installationId: string
}

/** The document title of the settings tab. */
export const agentSettingsMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("modulesCore")
    return { title: t("tab_settings") }
}

/** The settings tab of one instance: the cards read the instance in the browser; the page knows only the type. */
export const AgentSettingsPage = async (props: AgentSettingsPageProps): Promise<ReactElement> => {
    if (!isModuleKey(props.module)) notFound()
    const def = MODULE_REGISTRY[props.module]
    const t = await getTranslations("modulesCore")
    return (
        <AgentSettingsPageBase
            props={{
                module: props.module,
                installationId: props.installationId,
                glyph: def.glyph,
                extrasKey: def.settingsExtras,
                activityTitle: t("activityTitle"),
                answersCustomers: !INTERNAL_MODULES.has(props.module),
            }}
        />
    )
}
