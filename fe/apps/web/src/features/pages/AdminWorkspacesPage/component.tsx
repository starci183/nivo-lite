import { AdminWorkspaces } from "@/components/blocks/AdminWorkspaces"
import type { AdminWorkspaceFilter } from "@/hooks/admin"

/** The filter and the search the workspaces page was opened with. */
export interface AdminWorkspacesPageBaseProps {
    readonly props: {
        readonly filter: AdminWorkspaceFilter
        readonly query: string
    }
}

/** Draws the /admin screen body: the connected workspace list for a filter and a search. */
export const AdminWorkspacesPageBase = (props: AdminWorkspacesPageBaseProps) => (
    <AdminWorkspaces filter={props.props.filter} query={props.props.query} />
)
