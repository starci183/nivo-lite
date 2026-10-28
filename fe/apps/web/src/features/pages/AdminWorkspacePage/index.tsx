import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { AdminWorkspacePageBase } from "./component"

/** What the route hands the page: the workspace id of the address. */
type AdminWorkspacePageProps = {
    readonly params: Promise<{ readonly id: string }>
}

/** The document title of the page. */
export const adminWorkspaceMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("admin")
    return { title: t("workspaceEyebrow") }
}

/** The /admin/[id] screen body: the read-only overview of one workspace and the confirmed support actions, read in the browser. */
export const AdminWorkspacePage = async (props: AdminWorkspacePageProps) => {
    const { id } = await props.params
    const t = await getTranslations("admin")
    return (
        <AdminWorkspacePageBase
            props={{ workspaceId: id, eyebrow: t("workspaceEyebrow"), allWorkspacesLabel: t("allWorkspaces") }}
        />
    )
}
