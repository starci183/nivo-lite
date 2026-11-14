import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { developerApiUrl } from "@/modules/config"
import { DevelopersPageBase } from "./component"

/** The document title of the page. */
export const developersMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("developers")
    return { title: t("title") }
}

/** The "Developers" page: outgoing webhooks, the Claude connection, the keys and the quick guide, all for owner and manager; staff see a friendly 403. */
export const DevelopersPage = () => <DevelopersPageBase props={{ apiBase: `${developerApiUrl()}/api/v1` }} />

/** The same page while the route loads: the block keeps its band and sections and draws its own skeletons. */
export const DevelopersLoadingPage = () => <DevelopersPageBase props={{ apiBase: `${developerApiUrl()}/api/v1` }} />
