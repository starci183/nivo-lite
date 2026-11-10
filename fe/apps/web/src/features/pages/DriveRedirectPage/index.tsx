import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"

/** The document title while the old Drive address is forwarded. */
export const driveRedirectMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("driveConnection")
    return { title: t("googleTitle") }
}

/** What the old address carried: the workspace and its query (the open tab, the return of the Google consent). */
interface DriveRedirectPageProps {
    readonly workspaceId: string
    readonly query: Readonly<Record<string, string | ReadonlyArray<string> | undefined>>
}

/** The query as text: every value of every parameter, in order. */
const queryTextOf = (query: DriveRedirectPageProps["query"]): string => {
    const text = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
        for (const item of [value ?? []].flat()) text.append(key, item)
    }
    return text.toString()
}

/** Moved: Google is one provider with Drive inside it, so the old Drive address forwards to the Google account page and keeps its query. */
export const DriveRedirectPage = async (props: DriveRedirectPageProps): Promise<ReactElement> => {
    const base = workspaceHref(props.workspaceId, `${CONSOLE_ROUTES.connections}/google`)
    const text = queryTextOf(props.query)
    return navigation.redirect({
        href: text === "" ? base : `${base}?${text}`,
        locale: (await getLocale()) === "en" ? "en" : "vi",
    })
}
