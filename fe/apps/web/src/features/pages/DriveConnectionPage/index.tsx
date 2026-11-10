import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { CONNECTION_PAGE_VIEW_PARAM, connectionPageTabOf } from "@/modules/connection-page"
import { DriveConnectionPageBase } from "./component"

/** What the route supplies: its awaited-by-the-owner query. */
interface DriveConnectionPageProps {
    readonly searchParams?: Promise<Record<string, string | string[] | undefined>>
}

/** The document title of the Google account page. */
export const driveConnectionMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("driveConnection")
    return { title: t("googleTitle") }
}

/**
 * The page of the workspace's Google account (owner | manager): a server shell that picks the tab the address opens. The band, the
 * setup, the services, the facts, the agents, the steps, the ledger and the live rail each read their own data in the browser.
 */
export const DriveConnectionPage = async (props: DriveConnectionPageProps): Promise<ReactElement> => {
    const query = (await props.searchParams) ?? {}
    return <DriveConnectionPageBase props={{ tab: connectionPageTabOf(query[CONNECTION_PAGE_VIEW_PARAM]) }} />
}
