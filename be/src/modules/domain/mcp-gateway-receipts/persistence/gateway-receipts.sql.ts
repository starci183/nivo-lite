import { sql } from "@modules/platform/database"

/** Records sealed pending intent in its inbox claim transaction ($1 workspace, $2 operation key, $3 sealed result). */
export const INSERT_GATEWAY_RECEIPT = sql`INSERT INTO public.mcp_gateway_receipts (workspace_id, operation_key, result_sealed)
VALUES ($1, $2, $3)`

/** Replaces pending intent with the sealed connector outcome ($1 workspace, $2 operation key, $3 sealed result). */
export const UPDATE_GATEWAY_RECEIPT = sql`UPDATE public.mcp_gateway_receipts SET result_sealed = $3
WHERE workspace_id = $1 AND operation_key = $2`

/** Reads the pending or completed outcome of an operation whose inbox claim already exists ($1 workspace, $2 operation key). */
export const SELECT_GATEWAY_RECEIPT = sql`SELECT result_sealed FROM public.mcp_gateway_receipts
WHERE workspace_id = $1 AND operation_key = $2 LIMIT 1`
