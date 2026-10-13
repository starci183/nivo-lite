import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { developerApiUrl } from "@/modules/config"
import { DevelopersPageBase } from "./component"

/** The document title of the page. */
export const developersMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("developers")
    return { title: t("title") }
}

/** The "Advanced" page (owner or manager): outgoing webhooks, API keys, the quick guide. Staff see a friendly 403. */
export const DevelopersPage = () => <DevelopersPageBase props={{ apiBase: `${developerApiUrl()}/api/v1` }} />
