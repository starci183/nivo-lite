import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getTranslations } from "next-intl/server"
import type { ReactNode } from "react"
import { readAdminSession } from "@/modules/api"
import { AdminLayoutBase } from "./component"

/** What the admin route hands the layout: the routed page. */
type AdminLayoutProps = {
    readonly children: ReactNode
}

/** The document title of the console; it is never indexed. */
export const adminLayoutMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("admin")
    return { title: t("consoleTitle"), robots: { index: false, follow: false } }
}

/** The team console frame. Anyone the back end does not know as a platform admin gets a 404, so the console is not discoverable. */
export const AdminLayout = async (props: AdminLayoutProps) => {
    const t = await getTranslations("admin")
    const session = await readAdminSession()
    if (session.kind === "unavailable") throw new Error(`admin: session ${session.fault.code}`)
    if (session.kind !== "ok") notFound()
    return (
        <AdminLayoutBase props={{ title: t("consoleTitle"), email: session.value.email }}>
            {props.children}
        </AdminLayoutBase>
    )
}
