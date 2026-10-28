import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { creditsContactHref } from "@/modules/config"
import { pageHeadingOf } from "@/modules/page-header"
import { APP_ROUTES } from "@/modules/routes"
import { CreditsLoadingPageBase, CreditsPageBase } from "./component"

/** The document title of the page. */
export const creditsMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("credits")
    return { title: t("title") }
}

/** The words of the header band, resolved on the server so the page and its loading state say the same. */
const creditsHeader = async () => {
    const t = await getTranslations("credits")
    return {
        header: pageHeadingOf({
            crumbLabel: t("crumbLabel"),
            crumbs: [
                { id: "home", label: t("crumbHome"), href: APP_ROUTES.dashboard },
                { id: "credits", label: t("title") },
            ],
            title: t("title"),
            description: t("description"),
        }),
        historyLabel: t("historyAction"),
    }
}

/** Credits and plan; its connected block reads workspace data in the browser. */
export const CreditsPage = async () => (
    <CreditsPageBase props={{ ...(await creditsHeader()), contactHref: creditsContactHref() }} />
)

/** The same Page and slot placeholders during route loading. */
export const CreditsLoadingPage = async () => <CreditsLoadingPageBase props={await creditsHeader()} />
