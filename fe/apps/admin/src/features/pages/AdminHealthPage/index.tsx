import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { AdminHealthPageBase } from "./component"

/** The document title of the page. */
export const adminHealthMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("admin")
    return { title: t("navHealth") }
}

/** The /admin/health screen body: sign-ups, SePay billing, application errors and recent console activity, read in the browser. */
export const AdminHealthPage = () => <AdminHealthPageBase />
