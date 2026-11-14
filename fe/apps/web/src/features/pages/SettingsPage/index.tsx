import type { ReactElement } from "react"
import type { Metadata } from "next"
import type { PageHeaderContent } from "@starci/grammar/common"
import { getTranslations } from "next-intl/server"
import { consoleBreadcrumbsOf } from "@/modules/page-header"
import { workspaceHref } from "@/modules/routes"
import { SettingsPageBase } from "./component"

/** The document title of the page. */
export const settingsMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("settings")
    return { title: t("title") }
}

/** What the route hands the page: the workspace it is opened in and the tab it shows. */
interface SettingsPageProps {
    readonly workspaceId: string
    readonly view?: SettingsView
}

/** What the loading boundary of a tab hands the page. */
interface SettingsLoadingPageProps {
    readonly view?: SettingsView
}

/** The two tabs of the settings page: the general facts and the workspace's theme. */
type SettingsView = "general" | "theme"

/** The link of a tab inside the workspace, or none while the page only draws its loading state. */
const tabLinkIn = (workspaceId: string | undefined, path: string): { readonly href?: string } =>
    workspaceId === undefined ? {} : { href: workspaceHref(workspaceId, path) }

/** The words of the header band, resolved on the server so the page and its loading state say the same; no workspace while loading. */
const settingsHeader = async (view: SettingsView, workspaceId?: string): Promise<PageHeaderContent> => {
    const t = await getTranslations("settings")
    const shell = await getTranslations("shell")
    return {
        breadcrumbs: consoleBreadcrumbsOf({
            workspaceId,
            label: shell("crumbLabel"),
            home: shell("crumbHome"),
            current: t("title"),
        }),
        title: t("title"),
        description: t("description"),
        tabs: {
            label: t("tabsLabel"),
            labelVisibility: "always",
            selectedKey: view,
            items: [
                { id: "general", label: t("tabGeneral"), ...tabLinkIn(workspaceId, "/settings") },
                { id: "theme", label: t("tabTheme"), ...tabLinkIn(workspaceId, "/settings/theme") },
            ],
        },
    }
}

/** The /settings screen body: static copy; the settings are read in the browser from the back end GraphQL API. */
export const SettingsPage = async (props: SettingsPageProps): Promise<ReactElement> => {
    const view = props.view ?? "general"
    return <SettingsPageBase props={{ header: await settingsHeader(view, props.workspaceId), view }} />
}

/** The same page while the route loads: the real header, the two cards draw their own skeletons. */
export const SettingsLoadingPage = async (props: SettingsLoadingPageProps = {}): Promise<ReactElement> => {
    const view = props.view ?? "general"
    return <SettingsPageBase props={{ header: await settingsHeader(view), view }} />
}
