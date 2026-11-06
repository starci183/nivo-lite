import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"

/** The document title of the front address of a workspace, which only forwards. */
export const workspaceHomeRedirectMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("app")
    return { title: t("title") }
}

/** What the route hands the page: the workspace of the address. */
interface WorkspaceHomeRedirectPageProps {
    readonly workspaceId: string
}

/** The front address of a workspace forwards to its dashboard. */
export const WorkspaceHomeRedirectPage = async (props: WorkspaceHomeRedirectPageProps): Promise<ReactElement> =>
    navigation.redirect({
        href: workspaceHref(props.workspaceId, CONSOLE_ROUTES.dashboard),
        locale: (await getLocale()) === "en" ? "en" : "vi",
    })
