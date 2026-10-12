import type { Database } from "../../../../../../supabase/types/database.types"

/** One generated row of public.connections. */
export type ConnectionsRow = Database["public"]["Tables"]["connections"]["Row"]

/** One generated row of public.connection_secrets. */
export type ConnectionSecretsRow = Database["public"]["Tables"]["connection_secrets"]["Row"]

/** The columns the service reads of a connection (the row type holds more). */
export type ConnectionSelectRow = Pick<
    ConnectionsRow,
    | "id"
    | "workspace_id"
    | "provider"
    | "name"
    | "public_meta"
    | "status"
    | "last_error"
    | "environment"
    | "is_default"
    | "last_event_at"
    | "first_event"
    | "created_by"
    | "created_at"
>

/** The member columns authorisation reads. */
export type MemberRow = Pick<Database["public"]["Tables"]["workspace_members"]["Row"], "role" | "display_name">
