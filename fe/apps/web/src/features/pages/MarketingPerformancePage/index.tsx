import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"
import { MarketingPerformancePageBase } from "./component"

/** What the route hands the page: the type of the url. */
type MarketingPerformancePageProps = {
    readonly module: string
}

/** The document title of the performance tab. */
export const marketingPerformanceMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("modulesCore")
    return { title: t("tab_performance") }
}

/** The Performance tab of an instance: only the AI Marketing (content) agent has one. */
export const MarketingPerformancePage = (props: MarketingPerformancePageProps) => {
    if (props.module !== "content") notFound()
    return <MarketingPerformancePageBase />
}
