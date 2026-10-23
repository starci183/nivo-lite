import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import { isModuleKey } from "@/modules/catalog"
import { navigation } from "@/modules/i18n"

/** The document title while an old "add a module" url is forwarded. */
export const newModuleRedirectMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("modulesCore")
    return { title: t("catalogTitle") }
}

/** What the old url carried: the module to add. */
type NewModuleRedirectPageProps = {
    readonly module?: string | undefined
}

/** Moved: adding a module is the Install button of its agent type under /agents, so the old url forwards there. */
export const NewModuleRedirectPage = async (props: NewModuleRedirectPageProps) => {
    const locale = (await getLocale()) === "en" ? "en" : "vi"
    return navigation.redirect({ href: isModuleKey(props.module) ? `/agents/${props.module}` : "/agents", locale })
}
