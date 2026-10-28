import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { homePageHeadingOf } from "@/modules/page-header"
import { ProfilePageBase } from "./component"

/** The document title of the page. */
export const profileMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("account")
    return { title: t("profilePageTitle") }
}

/** The /profile screen body: static copy; the picture and the name are read in the browser from the back end GraphQL API. */
export const ProfilePage = async () => {
    const t = await getTranslations("account")
    return (
        <ProfilePageBase
            props={{
                header: homePageHeadingOf({
                    crumbLabel: t("crumbLabel"),
                    crumbHome: t("crumbHome"),
                    eyebrow: t("profileEyebrow"),
                    title: t("profilePageTitle"),
                    description: t("profilePageDescription"),
                }),
            }}
        />
    )
}
