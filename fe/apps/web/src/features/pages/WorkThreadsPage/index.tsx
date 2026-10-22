import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { WorkThreadsPageBase } from "./component"

/** The document title of the work threads page. */
export const workThreadsPageMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("workThreads")
    return { title: t("pageTitle") }
}

/** The work threads route: the connected board reads the threads in the browser. */
export const WorkThreadsPage = () => <WorkThreadsPageBase />
