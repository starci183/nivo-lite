import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { CONNECTION_PAGE_VIEW_PARAM, connectionPageTabOf } from "@/modules/connection-page"
import { SepayConnectionPageBase } from "./component"

/** What the route supplies: its awaited-by-the-owner path. */
interface SepayConnectionPageProps {
    readonly params: Promise<{ readonly id: string }>
    readonly searchParams?: Promise<Record<string, string | string[] | undefined>>
}

/** The document title of the SePay connection page. */
export const sepayConnectionMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("sepayConnection")
    return { title: t("title") }
}

/**
 * The page of one SePay connection (owner | manager): a server shell that picks the tab the address opens. The band, the setup, the
 * details, the agents and the live webhook events each read their own data in the browser.
 */
export const SepayConnectionPage = async (props: SepayConnectionPageProps): Promise<ReactElement> => {
    const { id } = await props.params
    const query = (await props.searchParams) ?? {}
    return (
        <SepayConnectionPageBase
            props={{ connectionId: id, tab: connectionPageTabOf(query[CONNECTION_PAGE_VIEW_PARAM]) }}
        />
    )
}
