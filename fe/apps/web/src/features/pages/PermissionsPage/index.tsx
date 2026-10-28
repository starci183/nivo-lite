import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { homePageHeadingOf } from "@/modules/page-header"
import { PermissionsPageBase } from "./component"

/** The document title of the page. */
export const permissionsMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("permissions")
    return { title: t("title") }
}

/** The /permissions screen body (owner and manager): static copy; the rules are read in the browser from the back end GraphQL API. */
export const PermissionsPage = async () => {
    const t = await getTranslations("permissions")
    return (
        <PermissionsPageBase
            props={{
                header: homePageHeadingOf({
                    crumbLabel: t("crumbLabel"),
                    crumbHome: t("crumbHome"),
                    eyebrow: t("eyebrow"),
                    title: t("title"),
                    description: t("description"),
                }),
            }}
        />
    )
}
