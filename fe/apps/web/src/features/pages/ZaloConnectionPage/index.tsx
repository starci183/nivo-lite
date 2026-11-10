import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { CONNECTION_PAGE_VIEW_PARAM, connectionPageTabOf } from "@/modules/connection-page"
import { ZaloConnectionPageBase } from "./component"

/** What the route supplies: its awaited-by-the-owner path. */
interface ZaloConnectionPageProps {
    readonly params: Promise<{ readonly id: string }>
    readonly searchParams?: Promise<Record<string, string | string[] | undefined>>
}

/** The document title of the Zalo OA connection page. */
export const zaloConnectionMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("zaloConnection")
    return { title: t("title") }
}

/**
 * The page of one Zalo OA connection (owner | manager): a server shell that picks the tab the address opens. The band, the setup, the
 * facts, the agents, the ZNS template and the live rail each read their own data in the browser.
 */
export const ZaloConnectionPage = async (props: ZaloConnectionPageProps): Promise<ReactElement> => {
    const { id } = await props.params
    const query = (await props.searchParams) ?? {}
    return (
        <ZaloConnectionPageBase
            props={{ connectionId: id, tab: connectionPageTabOf(query[CONNECTION_PAGE_VIEW_PARAM]) }}
        />
    )
}
