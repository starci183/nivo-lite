import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { isAdminWorkspaceFilter } from "@/hooks/admin"
import { AdminWorkspacesPageBase } from "./component"

/** The longest search the page forwards. */
const QUERY_MAX = 120

/** What the route hands the page: the address query it was opened with. */
type AdminWorkspacesPageProps = {
    readonly searchParams: Promise<{ readonly f?: string; readonly q?: string }>
}

/** The document title of the page. */
export const adminWorkspacesMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("admin")
    return { title: t("navWorkspaces") }
}

/** The /admin screen body: every customer workspace the filter and the search keep, read in the browser from the back end. */
export const AdminWorkspacesPage = async (props: AdminWorkspacesPageProps) => {
    const { f, q } = await props.searchParams
    return (
        <AdminWorkspacesPageBase
            props={{ filter: isAdminWorkspaceFilter(f) ? f : "all", query: (q ?? "").slice(0, QUERY_MAX) }}
        />
    )
}
