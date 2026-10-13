import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { PublicLoyaltyPageBase } from "./component"

/** What the route passes through: the slug in the URL. */
interface PublicLoyaltyPageProps {
    readonly params: Promise<{ readonly slug: string }>
}

/** The document title of the public points page; the page is never indexed. */
export const publicLoyaltyMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("loyaltyPublic")
    return { title: t("title"), robots: { index: false, follow: false } }
}

/** /l/<slug>: the public points check, no login. The server only mounts the shell; the connected block reads the shop and talks to the API from the browser. */
export const PublicLoyaltyPage = async (props: PublicLoyaltyPageProps) => {
    const { slug } = await props.params
    const t = await getTranslations("loyaltyPublic")
    return <PublicLoyaltyPageBase props={{ slug, label: t("title") }} />
}
