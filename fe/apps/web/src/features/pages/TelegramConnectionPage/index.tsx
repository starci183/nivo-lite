import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { CONNECTION_PAGE_VIEW_PARAM, connectionPageTabOf } from "@/modules/connection-page"
import { TelegramConnectionPageBase } from "./component"

/** What the route supplies: its awaited-by-the-owner path. */
interface TelegramConnectionPageProps {
    readonly params: Promise<{ readonly id: string }>
    readonly searchParams?: Promise<Record<string, string | string[] | undefined>>
}

/** The document title of the Telegram bot connection page. */
export const telegramConnectionMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("telegramConnection")
    return { title: t("title") }
}

/**
 * The page of one Telegram bot connection (owner | manager): a server shell that picks the tab the address opens. The band comes from the layout; the notices, the setup,
 * facts, the agents, the steps and the live rail each read their own data in the browser.
 */
export const TelegramConnectionPage = async (props: TelegramConnectionPageProps): Promise<ReactElement> => {
    const { id } = await props.params
    const query = (await props.searchParams) ?? {}
    return (
        <TelegramConnectionPageBase
            props={{ connectionId: id, tab: connectionPageTabOf(query[CONNECTION_PAGE_VIEW_PARAM]) }}
        />
    )
}
