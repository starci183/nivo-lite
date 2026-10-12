import type { Database } from "../../../../../../supabase/types/database.types"

/** A connection as FIND_INTAKE_CONNECTION selects it. */
export type IntakeConnectionRow = Pick<Database["public"]["Tables"]["connections"]["Row"], "id" | "workspace_id" | "status">
