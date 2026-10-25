import { sql } from "@modules/platform/database"

/** Links a customer captured after a durable API handoff ($1 workspace, $2 ledger request, $3 customer). */
export const LINK_PUBLIC_API_LEAD = sql`UPDATE public.public_api SET lead_id = $3::uuid
WHERE workspace_id = $1::uuid AND id = $2::uuid AND kind = 'lead'`
