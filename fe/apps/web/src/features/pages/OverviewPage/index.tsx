import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { OverviewPageBase } from "./component"

/** The document title of the overview: the home page name. */
export const overviewMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("shell")
    return { title: t("crumbHome") }
}

/** The executive overview: the connected pane block reads the dashboard in the browser. */
export const OverviewPage = (): ReactElement => <OverviewPageBase />
