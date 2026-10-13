import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { AuthorityPageBase } from "./component"

/** The document title of the authority page. */
export const authorityPageMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("authority")
    return { title: t("title") }
}

/** The authority route: a shell that mounts the connected sections, which read and save through the back end in the browser. */
export const AuthorityPage = () => <AuthorityPageBase />
