import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { OverviewHome } from "@/components/blocks/OverviewHome"

/** The document title of the page. */
export const overviewMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("overview")
    return { title: t("title") }
}

/** The overview route: the one block of the home, which picks the owner's dashboard or a member's day by role and draws the one `Page`, its header band included. */
export const OverviewPage = () => <OverviewHome />

/** The same home while the route loads: the block draws its own band and skeletons. */
export const OverviewLoadingPage = () => <OverviewHome />
