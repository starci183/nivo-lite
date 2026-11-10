import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { RoleHome } from "./RoleHome"

/** The document title of the page. */
export const overviewMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("overview")
    return { title: t("title") }
}

/** The overview route: the home is chosen by role, and the block it picks draws the one `Page`, its header band included. */
export const OverviewPage = () => <RoleHome />
