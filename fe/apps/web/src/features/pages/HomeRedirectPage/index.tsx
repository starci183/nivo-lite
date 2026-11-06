import type { ReactElement } from "react"
import type { Metadata } from "next"
import { cookies } from "next/headers"
import { getLocale, getTranslations } from "next-intl/server"
import { navigation } from "@/modules/i18n"
import { AUTH_ROUTES, CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import { WORKSPACE_COOKIE } from "@/modules/storage"

/** The document title of the front address, which only forwards. */
export const homeRedirectMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("app")
    return { title: t("title") }
}

/** The front address forwards to the dashboard of the workspace the person opened last, else to the workspaces page where they pick one. */
export const HomeRedirectPage = async (): Promise<ReactElement> => {
    const remembered = (await cookies()).get(WORKSPACE_COOKIE)?.value
    return navigation.redirect({
        href:
            remembered === undefined
                ? AUTH_ROUTES.workspaces
                : workspaceHref(decodeURIComponent(remembered), CONSOLE_ROUTES.dashboard),
        locale: (await getLocale()) === "en" ? "en" : "vi",
    })
}
