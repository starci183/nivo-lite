import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { rowDueOf, rowStatusOf } from "@/hooks/responsibilities"
import { ResponsibilitiesPageBase } from "./component"

/** What the route passes: the filters of the query string, as text. */
interface ResponsibilitiesPageProps {
    readonly status: string
    readonly due: string
}

/** The document title of the responsibilities page. */
export const responsibilitiesPageMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("responsibilities")
    return { title: t("pageTitle") }
}

/** The responsibilities route: the filters of the query string go to the connected board, which reads the rows in the browser. */
export const ResponsibilitiesPage = (props: ResponsibilitiesPageProps) => (
    <ResponsibilitiesPageBase
        props={{ initial: { status: rowStatusOf(props.status) ?? "all", due: rowDueOf(props.due) ?? "any" } }}
    />
)
