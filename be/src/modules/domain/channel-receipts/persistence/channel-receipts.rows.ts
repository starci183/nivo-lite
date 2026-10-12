import type { Database } from "../../../../../../supabase/types/database.types"

/** The receipt of a holding line. */
export type HoldingReceiptRow = Pick<Database["public"]["Tables"]["channel_receipts"]["Row"], "receipt_id">
