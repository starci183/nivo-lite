import type { ReactElement } from "react"
import { getTranslations } from "next-intl/server"
import { AdminNotFound } from "@/components/blocks/AdminNotFound"

/** Shown when a route does not exist or the caller is not a platform admin. */
export const AdminNotFoundPage = async (): Promise<ReactElement> => {
    const t = await getTranslations("app")
    return <AdminNotFound title={t("notFoundTitle")} text={t("notFoundText")} homeLabel={t("notFoundHome")} />
}
