import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"
import { numberColumn } from "./number-column.mapper"

@Entity({ schema: "public", name: "credit_pack_purchases" })
/** One row of public.credit_pack_purchases: an add-on pack a workspace paid for. */
export class CreditPackPurchaseEntity extends UuidAbstractEntity {
    /** The workspace id. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The payment order that bought the pack. */
    @Column({ name: "order_id", type: "uuid" })
    orderId!: string

    /** The credits added. */
    @Column({ name: "credits", type: "bigint", transformer: numberColumn })
    credits!: number

    /** The price paid in VND. */
    @Column({ name: "price_vnd", type: "bigint", transformer: numberColumn })
    priceVnd!: number

    /** The month the credits count for, as its first day. */
    @Column({ name: "period", type: "date" })
    period!: string

    /** When it was paid. */
    @Column({ name: "purchased_at", type: "timestamptz", default: () => "now()" })
    purchasedAt!: Date
}
