import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { LandingPage } from "@/features/pages/LandingPage"

/** The document title and description of the landing page. */
export const generateMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("app")
    return { title: t("title"), description: t("homeDescription") }
}

/** Public landing page (default route). */
const Page = () => <LandingPage />

export default Page
