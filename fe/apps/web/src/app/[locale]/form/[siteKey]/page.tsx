import type { ReactElement } from "react"
import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { WebsiteFormPage } from "@/features/pages/WebsiteFormPage"

/** The form title in the visitor's language; the page is shown inside the website of a shop, so search engines leave it out. */
export const generateMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("websiteForm")
    return { title: t("title"), robots: { index: false } }
}

/** Rendered per request: the page reads the public key of its address. */
export const dynamic = "force-dynamic"

/** The public key carried by the route. */
interface WebsiteFormParams {
    readonly siteKey: string
}

/** Next supplies route parameters asynchronously. */
interface PageProps {
    readonly params: Promise<WebsiteFormParams>
}

/** The hosted form of one shop website. */
const Page = async (props: PageProps): Promise<ReactElement> => (
    <WebsiteFormPage siteKey={(await props.params).siteKey} />
)

export default Page
