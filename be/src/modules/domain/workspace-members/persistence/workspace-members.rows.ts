import type { Database } from "../../../../../../supabase/types/database.types"
import type { WorkspaceRole } from "../workspace-members.contracts"

/** public.workspace_members as the membership reads select it. */
export type MemberRow = Pick<
    Database["public"]["Tables"]["workspace_members"]["Row"],
    "workspace_id" | "user_id" | "staff_id" | "display_name"
> & {
    /** Constrained by a CHECK in the table. */
    role: WorkspaceRole
    /** Constrained by a CHECK in the table. */
    status: "active" | "disabled"
}
