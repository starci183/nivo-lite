import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getFormatter, getTranslations } from "next-intl/server"
import { adminFormat, healthCards } from "@/hooks/admin"
import { readAdminHealth } from "@/modules/db"
import { AdminHealthPageBase } from "./component"

/** The document title of the page. */
export const adminHealthMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("admin")
    return { title: t("navHealth") }
}

/** The /admin/health screen body: sign-ups, SePay billing, application errors and recent console activity. */
export const AdminHealthPage = async () => {
    const t = await getTranslations("admin")
    const format = adminFormat(await getFormatter(), t, new Date())
    const health = await readAdminHealth()
    if (health.kind === "unavailable") throw new Error(`admin: health ${health.code}`)
    if (health.kind !== "ok") notFound()
    return (
        <AdminHealthPageBase
            props={{
                eyebrow: t("healthEyebrow"),
                title: t("healthTitle"),
                description: t("healthDescription"),
                cards: healthCards(health.value, format, t),
            }}
        />
    )
}
