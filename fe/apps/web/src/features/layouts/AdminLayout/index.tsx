import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import type { ReactNode } from "react"
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

/** The team console frame. Anyone the back end does not know as a platform admin gets a 404 (the account in the top bar), so the console is not discoverable. */
export const AdminLayout = async (props: AdminLayoutProps) => {
    const t = await getTranslations("admin")
    return <AdminLayoutBase props={{ title: t("consoleTitle") }}>{props.children}</AdminLayoutBase>
}
