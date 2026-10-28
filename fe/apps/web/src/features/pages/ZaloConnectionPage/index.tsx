import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { ZALO_TABS } from "@/modules/types"
import { ZaloConnectionPageBase } from "./component"
import type { ZaloConnectionShape } from "./component"

/** What the route supplies: its awaited-by-the-owner path and query. */
interface ZaloConnectionPageProps {
    readonly params: Promise<{ readonly id: string }>
    readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** The document title of the Zalo OA connection page. */
export const zaloConnectionMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("zaloConnection")
    return { title: t("title") }
}

const shapeOf = (tab: string | string[] | undefined): ZaloConnectionShape =>
    ZALO_TABS.find((candidate) => candidate === tab) ?? "check"

/**
 * The page of one Zalo OA connection (owner | manager): a server shell. The tab of the query string picks the arrangement; the header,
 * the checks, the test send, the addresses and the live events each read their own data in the browser.
 */
export const ZaloConnectionPage = async (props: ZaloConnectionPageProps) => {
    const { id } = await props.params
    const { tab } = await props.searchParams
    return <ZaloConnectionPageBase shape={shapeOf(tab)} props={{ connectionId: id }} />
}
