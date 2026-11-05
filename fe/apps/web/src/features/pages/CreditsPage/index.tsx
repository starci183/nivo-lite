import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { creditsContactHref } from "@/modules/config"
import { CreditsLoadingPageBase, CreditsPageBase } from "./component"

/** The document title of the page. */
export const creditsMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("credits")
    return { title: t("title") }
}

/** The words of the header band, resolved on the server so the page and its loading state say the same. */
const creditsHeader = async () => {
    const t = await getTranslations("credits")
    const b = await getTranslations("billing")
    return { header: { title: t("title"), description: t("description") }, plansLabel: b("comparePlans") }
}

/** Credits and plan; its connected block reads workspace data in the browser. */
export const CreditsPage = async (): Promise<ReactElement> => (
    <CreditsPageBase props={{ header: (await creditsHeader()).header, contactHref: creditsContactHref() }} />
)

/** The same Page and slot placeholders during route loading. */
export const CreditsLoadingPage = async (): Promise<ReactElement> => (
    <CreditsLoadingPageBase props={await creditsHeader()} />
)
