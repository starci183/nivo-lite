import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import type { ProviderPageTab } from "@/modules/types"
import { ConnectionOpenAddressBody } from "./AddressBody"
import { ConnectionOpenPageBase } from "./component"

/** What the route supplies: the account's id, and the tab its segment names (the Config tab when the route is the page itself). */
interface ConnectionOpenPageProps {
    readonly params: Promise<{ readonly id: string }>
    readonly tab?: ProviderPageTab
}

/** What a loading boundary supplies: the tab its segment names. */
interface ConnectionOpenLoadingPageProps {
    readonly tab?: ProviderPageTab
}

/** The document title of a connected account's page. */
export const connectionOpenMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("connections")
    return { title: t("openLabel") }
}

/** The page of a connected account (the provider page template): a server shell that draws the tab its route names. */
export const ConnectionOpenPage = async (props: ConnectionOpenPageProps): Promise<ReactElement> => {
    const { id } = await props.params
    return <ConnectionOpenPageBase props={{ connectionId: id, tab: props.tab ?? "config" }} />
}

/**
 * The same tab body while the route loads, under the band its layout keeps: each tab's regions draw their own skeletons. A loading
 * boundary receives no params, so the body reads the account from the browser's address (the band's tabs do the same).
 */
export const ConnectionOpenLoadingPage = (props: ConnectionOpenLoadingPageProps): ReactElement => (
    <ConnectionOpenAddressBody tab={props.tab ?? "config"} />
)
