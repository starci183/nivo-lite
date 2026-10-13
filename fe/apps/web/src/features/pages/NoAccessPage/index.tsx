import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import { navigation } from "@/modules/i18n"
import { workspacesPath } from "@/modules/routes"

/** What the route passes through: the query of the old no-access URL. */
interface NoAccessPageProps {
    readonly searchParams: Promise<{ readonly reason?: string }>
}

/** The document title of the page. */
export const noAccessMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("access")
    return { title: t("noWorkspace") }
}

/** Old entry point: everything about "no workspace yet" or "disabled" now lives on /workspaces. */
export const NoAccessPage = async (props: NoAccessPageProps) => {
    const { reason } = await props.searchParams
    navigation.redirect({
        href: workspacesPath(reason === "disabled" ? "disabled" : "none"),
        locale: await getLocale(),
    })
    return null
}
