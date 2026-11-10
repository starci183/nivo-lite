import type { ReactElement } from "react"
import { getTranslations } from "next-intl/server"
import { AppNotFound } from "@/components/blocks/AppNotFound"

/** Shown when a route does not exist or the caller is not a platform admin. */
export const AppNotFoundPage = async (): Promise<ReactElement> => {
    const t = await getTranslations("app")
    return <AppNotFound title={t("notFoundTitle")} text={t("notFoundText")} homeLabel={t("notFoundHome")} />
}
