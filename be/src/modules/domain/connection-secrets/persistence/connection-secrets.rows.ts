import type { Database } from "../../../../../../supabase/types/database.types"

type Tables = Database["public"]["Tables"]

/** A connection with its sealed credential, as FIND_CONNECTION_SECRET selects it. */
export type ConnectionSecretRow = Pick<Tables["connections"]["Row"], "workspace_id" | "provider" | "status"> &
    Pick<Tables["connection_secrets"]["Row"], "ciphertext" | "webhook_secret" | "token_expires_at">

/** The id of a lease taken or of a due Zalo connection. */
export type ConnectionIdRow = Pick<Tables["connection_secrets"]["Row"], "connection_id">
