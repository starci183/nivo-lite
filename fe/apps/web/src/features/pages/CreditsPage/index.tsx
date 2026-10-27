import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { CreditsHistorySkeleton } from "@/components/blocks/CreditsHistory"
import { CreditsOverviewSkeleton } from "@/components/blocks/CreditsOverview"
import { creditsContactHref } from "@/modules/config"
import { CreditsPageBase } from "./component"

/** The document title of the page. */
export const creditsMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("credits")
    return { title: t("title") }
}

/** Credits and plan; its connected block reads workspace data in the browser. */
export const CreditsPage = () => <CreditsPageBase props={{ contactHref: creditsContactHref() }} />

/** The same static frame and slot placeholders during route loading. */
export const CreditsLoadingPage = () => (
    <>
        <CreditsOverviewSkeleton />
        <CreditsHistorySkeleton />
    </>
)
