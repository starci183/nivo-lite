import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { CONNECTION_PAGE_VIEW_PARAM, connectionPageTabOf } from "@/modules/connection-page"
import { ConnectionOpenPageBase } from "./component"

/** What the route supplies: its awaited-by-the-owner query. */
interface ConnectionOpenPageProps {
    readonly params: Promise<{ readonly id: string }>
    readonly searchParams?: Promise<Record<string, string | string[] | undefined>>
}

/** The document title of the page of a connection without a page of its own. */
export const connectionOpenMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("connections")
    return { title: t("openLabel") }
}

/** The page of a connection without a page of its own (owner | manager): a server shell that picks the tab the address opens. */
export const ConnectionOpenPage = async (props: ConnectionOpenPageProps): Promise<ReactElement> => {
    const { id } = await props.params
    const query = (await props.searchParams) ?? {}
    return (
        <ConnectionOpenPageBase
            props={{ connectionId: id, tab: connectionPageTabOf(query[CONNECTION_PAGE_VIEW_PARAM]) }}
        />
    )
}
