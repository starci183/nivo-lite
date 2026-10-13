import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { OverviewPageBase } from "./component"

/** The document title of the overview: the home page name. */
export const overviewMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("shell")
    return { title: t("crumbHome") }
}

/** The executive overview: a server shell that lays out connected regions, each reading its data in the browser. */
export const OverviewPage = () => <OverviewPageBase />
