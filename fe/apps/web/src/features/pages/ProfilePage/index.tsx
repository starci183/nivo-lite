import type { ReactElement } from "react"
import type { Metadata } from "next"
import type { PageHeaderContent } from "@starci/grammar/common"
import { getTranslations } from "next-intl/server"
import { accountHeadingOf } from "@/modules/page-header"
import { ProfilePageBase } from "./component"

/** The document title of the page. */
export const profileMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("account")
    return { title: t("profilePageTitle") }
}

/** What the route hands the page: the workspace it is opened in. */
interface ProfilePageProps {
    readonly workspaceId: string
}

/** The words of the header band, resolved on the server so the page and its loading state say the same; no workspace while loading. */
const profileHeader = async (workspaceId?: string): Promise<PageHeaderContent> => {
    const t = await getTranslations("account")
    const shell = await getTranslations("shell")
    return accountHeadingOf({
        workspaceId,
        crumbLabel: shell("crumbLabel"),
        home: shell("crumbHome"),
        title: t("profilePageTitle"),
        description: t("profilePageDescription"),
        tabsLabel: t("tabsLabel"),
        profileLabel: t("tabProfile"),
        accountLabel: t("tabAccount"),
        selected: "profile",
    })
}

/** The /profile screen: the header with the two personal tabs, then the profile form read in the browser. */
export const ProfilePage = async (props: ProfilePageProps): Promise<ReactElement> => (
    <ProfilePageBase props={{ header: await profileHeader(props.workspaceId) }} />
)

/** The same page while the route loads: the real header and tabs, the form draws its own skeleton. */
export const ProfileLoadingPage = async (): Promise<ReactElement> => (
    <ProfilePageBase props={{ header: await profileHeader() }} />
)
