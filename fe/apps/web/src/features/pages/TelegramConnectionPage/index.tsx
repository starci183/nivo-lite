import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { TelegramConnectionPageBase } from "./component"

/** What the route supplies: its awaited-by-the-owner path. */
interface TelegramConnectionPageProps {
    readonly params: Promise<{ readonly id: string }>
}

/** The document title of the Telegram bot connection page. */
export const telegramConnectionMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("telegramConnection")
    return { title: t("title") }
}

/**
 * The page of one Telegram bot connection (owner | manager): a server shell. The header, the health tiles, the steps and the live
 * events each read their own data in the browser.
 */
export const TelegramConnectionPage = async (props: TelegramConnectionPageProps) => {
    const { id } = await props.params
    return <TelegramConnectionPageBase props={{ connectionId: id }} />
}
