import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { TeamPageBase } from "./component"

/** The document title of the page. */
export const teamMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("team")
    return { title: t("title") }
}

/** The /team screen body (owner and manager): static copy; the roster is read in the browser from the back end GraphQL API. Staff see a friendly 403. */
export const TeamPage = async () => {
    const t = await getTranslations("team")
    return (
        <TeamPageBase
            props={{
                crumbLabel: t("crumbLabel"),
                crumbHome: t("crumbHome"),
                eyebrow: t("eyebrow"),
                title: t("title"),
                description: t("description"),
            }}
        />
    )
}
