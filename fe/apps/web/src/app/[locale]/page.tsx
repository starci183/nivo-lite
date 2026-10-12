import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { Landing } from "@/features/landing"

/** The document title and description of the landing page. */
export const generateMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("app")
    return { title: t("title"), description: t("homeDescription") }
}

/** Public landing page (default route). */
const Page = () => <Landing />

export default Page
