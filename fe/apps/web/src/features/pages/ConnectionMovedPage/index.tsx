import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getLocale, getTranslations } from "next-intl/server"
import { providerPageTabPath } from "@/modules/connection-page"
import { navigation } from "@/modules/i18n"
import { workspaceHref } from "@/modules/routes"
import type { ProviderPageTab } from "@/modules/types"

/** What the old address carried: the workspace, the account, and the old tab (`?view=` or `?tab=`) when it named one. */
type ConnectionMovedPageProps = {
    readonly workspaceId: string
    readonly connectionId: string
    readonly view: string | undefined
}

/** The tab an old per-provider tab now lives on: its agents are the Rights tab; everything else is the Config tab. */
const tabOfOldView = (view: string | undefined): ProviderPageTab => (view === "agents" ? "rights" : "config")

/** The document title while the old address is forwarded. */
export const connectionMovedMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("connections")
    return { title: t("openLabel") }
}

/** Moved: SePay, Zalo OA and Telegram accounts open on the one provider page template, so their old addresses forward there. */
export const ConnectionMovedPage = async (props: ConnectionMovedPageProps): Promise<ReactElement> =>
    navigation.redirect({
        href: workspaceHref(props.workspaceId, providerPageTabPath(props.connectionId, tabOfOldView(props.view))),
        locale: (await getLocale()) === "en" ? "en" : "vi",
    })
