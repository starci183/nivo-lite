import type { Database } from "../../../../../../supabase/types/database.types"
import type { OrderKind, OrderStatus } from "../payment-orders.contracts"

type OrderTable = Database["public"]["Tables"]["payment_orders"]["Row"]

/** One payment order as the order statements answer it; the amount is cast to float8 in SQL so the driver answers a number. */
export interface OrderRow extends Pick<
    OrderTable,
    | "id"
    | "workspace_id"
    | "plan_code"
    | "order_code"
    | "expires_at"
    | "paid_at"
    | "created_at"
    | "pack_code"
    | "detail"
> {
    /** The amount to transfer in VND. */
    readonly amount_vnd: number
    /** The status, a member of the table check. */
    readonly status: OrderStatus
    /** The kind, a member of the table check. */
    readonly kind: OrderKind
}
