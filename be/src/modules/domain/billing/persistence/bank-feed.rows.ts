import type { Database } from "../../../../../../supabase/types/database.types"

type Tables = Database["public"]["Tables"]

/** One connection joined with its secret row. */
export type ConnectionSecretRow = Pick<Tables["connections"]["Row"], "workspace_id" | "status" | "provider"> &
    Pick<Tables["connection_secrets"]["Row"], "ciphertext" | "webhook_secret">

/** The facts of a connection the bank feed reads before it records a credit. */
export type ConnectionStateRow = Pick<Tables["connections"]["Row"], "name" | "environment" | "status">

/** An agent id. */
export type AgentIdRow = Pick<Tables["agents"]["Row"], "id">
