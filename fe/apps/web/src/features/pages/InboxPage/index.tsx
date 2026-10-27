import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { InboxPageBase } from "./component"

/** The document title of the page. */
export const inboxMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("inbox")
    return { title: t("title") }
}

/** Server shell for the GraphQL inbox feed. */
export const InboxPage = async () => {
    const t = await getTranslations("inbox")
    return (
        <InboxPageBase
            props={{
                crumbLabel: t("crumbLabel"),
                crumbHomeLabel: t("crumbHome"),
                crumbHomeHref: CONSOLE_ROUTES.dashboard,
                eyebrow: t("eyebrow"),
                title: t("title"),
                description: t("description"),
            }}
        />
    )
}
