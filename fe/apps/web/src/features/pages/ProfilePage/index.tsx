import type { ReactElement } from "react"
import type { Metadata } from "next"
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

/** The /profile screen body: static copy; the picture and the name are read in the browser from the back end GraphQL API. */
export const ProfilePage = async (props: ProfilePageProps): Promise<ReactElement> => {
    const t = await getTranslations("account")
    const shell = await getTranslations("shell")
    return (
        <ProfilePageBase
            props={{
                header: accountHeadingOf({
                    workspaceId: props.workspaceId,
                    crumbLabel: shell("crumbLabel"),
                    home: shell("crumbHome"),
                    title: t("profilePageTitle"),
                    description: t("profilePageDescription"),
                    tabsLabel: t("tabsLabel"),
                    profileLabel: t("tabProfile"),
                    accountLabel: t("tabAccount"),
                    selected: "profile",
                }),
            }}
        />
    )
}
