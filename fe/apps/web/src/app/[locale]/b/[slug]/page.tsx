import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { notFound } from "next/navigation"

/** The document title of the page; it is never indexed. */
export const generateMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("workbenchBooking")
    return { title: t("publicTitle"), robots: { index: false } }
}

/** Public booking page of one shop. The page is rebuilt over the back end GraphQL API; until then the route answers not found. */
const Page = () => notFound()

export default Page
