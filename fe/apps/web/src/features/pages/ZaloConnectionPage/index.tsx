import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { ZaloConnectionPageBase } from "./component"

/** What the route supplies: its awaited-by-the-owner path. */
interface ZaloConnectionPageProps {
    readonly params: Promise<{ readonly id: string }>
}

/** The document title of the Zalo OA connection page. */
export const zaloConnectionMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("zaloConnection")
    return { title: t("title") }
}

/**
 * The page of one Zalo OA connection (owner | manager): a server shell. The header, the health tiles, the setup steps, the ZNS template
 * and the live events each read their own data in the browser.
 */
export const ZaloConnectionPage = async (props: ZaloConnectionPageProps) => {
    const { id } = await props.params
    return <ZaloConnectionPageBase props={{ connectionId: id }} />
}
