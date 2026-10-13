import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getFormatter, getTranslations } from "next-intl/server"
import { adminFormat, workspaceRows } from "@/hooks/admin"
import { isAdminWorkspaceFilter, readAdminWorkspaces } from "@/modules/db"
import type { AdminWorkspaceFilter } from "@/modules/db/admin/admin.mapper"
import { adminListPath } from "@/modules/routes"
import { AdminWorkspacesPageBase } from "./component"

/** The filters the list offers, in the order of its chips. */
const FILTER_IDS: ReadonlyArray<AdminWorkspaceFilter> = ["all", "attention", "unpaid", "idle"]

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

/** The /admin screen body: every customer workspace the filter and the search keep, read from the back end. */
export const AdminWorkspacesPage = async (props: AdminWorkspacesPageProps) => {
    const t = await getTranslations("admin")
    const format = adminFormat(await getFormatter(), t, new Date())
    const { f, q } = await props.searchParams
    const filter = isAdminWorkspaceFilter(f) ? f : "all"
    const query = (q ?? "").slice(0, QUERY_MAX)
    const list = await readAdminWorkspaces({ filter, query })
    if (list.kind === "unavailable") throw new Error(`admin: workspaces ${list.code}`)
    if (list.kind !== "ok") notFound()
    return (
        <AdminWorkspacesPageBase
            props={{
                eyebrow: t("workspacesEyebrow"),
                title: t("workspacesTitle", { count: list.value.total }),
                description: t("workspacesDescription"),
                searchLabel: t("searchLabel"),
                searchField: t("searchField"),
                searchPlaceholder: t("searchPlaceholder"),
                searchSubmit: t("searchSubmit"),
                filtersLabel: t("filtersLabel"),
                shownTitle: t("shownTitle", { count: list.value.items.length }),
                tableLabel: t("tableLabel"),
                emptyTitle: t("emptyTitle"),
                emptyHint: t("emptyHint"),
                attentionLabel: t("badgeAttention"),
                noneLabel: t("none"),
                columns: {
                    workspace: t("colWorkspace"),
                    owner: t("colOwner"),
                    billing: t("colBilling"),
                    plan: t("colPlan"),
                    created: t("colCreated"),
                    members: t("colMembers"),
                    agents: t("colAgents"),
                    connections: t("colConnections"),
                    lastMessage: t("colLastMessage"),
                    messages: t("colMessages"),
                    waiting: t("colWaiting"),
                },
                query,
                filter,
                filters: FILTER_IDS.map((id) => ({
                    id,
                    href: adminListPath(id, query),
                    label: t("filterChoice", {
                        label: t(`filter${id.charAt(0).toUpperCase()}${id.slice(1)}`),
                        count: list.value.counts[id],
                    }),
                })),
                rows: workspaceRows(list.value.items, format, t),
            }}
        />
    )
}
