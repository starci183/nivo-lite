import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { OfficePageBase } from "./component"

/** The document title of the Office. */
export const officePageMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("office")
    return { title: t("title") }
}

/** The Office route: the messenger reads its thread, approvals and team in the browser from the back end GraphQL API. */
export const OfficePage = () => <OfficePageBase />
