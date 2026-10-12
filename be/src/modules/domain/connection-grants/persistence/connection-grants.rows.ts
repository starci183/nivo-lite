import type { Database } from "../../../../../../supabase/types/database.types"

/** The agent columns a grant check reads. */
export type AgentRow = Pick<Database["public"]["Tables"]["agents"]["Row"], "id" | "name" | "module">

/** The columns of a stored grant. */
export type GrantRow = Pick<
    Database["public"]["Tables"]["agent_connections"]["Row"],
    "agent_id" | "connection_id" | "access"
>
