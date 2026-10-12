import type { Database } from "../../../../../../supabase/types/database.types"

type Tables = Database["public"]["Tables"]

/** A membership of the caller joined with its workspace, as the memberships read selects it. */
export type MembershipRow = Pick<
    Tables["workspace_members"]["Row"],
    "workspace_id" | "user_id" | "staff_id" | "display_name"
> & {
    /** Constrained by a CHECK in the table. */
    role: "owner" | "manager" | "staff"
    /** Constrained by a CHECK in the table. */
    status: "active" | "disabled"
    /** The workspace name. */
    workspace_name: Tables["workspaces"]["Row"]["name"]
    /** The workspace status. */
    workspace_status: Tables["workspaces"]["Row"]["status"]
    /** The Auth user who owns the workspace. */
    owner_id: Tables["workspaces"]["Row"]["owner_id"]
    /** When the workspace was created. */
    workspace_created_at: Tables["workspaces"]["Row"]["created_at"]
    /** The business type chosen at onboarding. */
    business_type: Tables["workspaces"]["Row"]["business_type"]
}

/** The id of a created workspace. */
export type CreatedRow = Pick<Tables["workspaces"]["Row"], "id">
