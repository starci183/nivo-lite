import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"
import { numberColumn } from "./number-column.mapper"

@Entity({ schema: "public", name: "credit_topups" })
/** One row of public.credit_topups: a purchased top-up lot. */
export class CreditTopupEntity {
    /** The id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace id. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The credits purchased. */
    @Column({ name: "credits", type: "bigint", transformer: numberColumn })
    credits!: number

    /** The credits still spendable. */
    @Column({ name: "credits_remaining", type: "bigint", transformer: numberColumn })
    creditsRemaining!: number

    /** The price paid in VND. */
    @Column({ name: "price_vnd", type: "bigint", transformer: numberColumn })
    priceVnd!: number

    /** The payment order that bought the lot. */
    @Column({ name: "order_id", type: "uuid" })
    orderId!: string

    /** The pack the lot came from, when there is one. */
    @Column({ name: "pack_code", type: "text", nullable: true })
    packCode!: string | null

    /** When the lot was purchased. */
    @Column({ name: "purchased_at", type: "timestamptz", default: () => "now()" })
    purchasedAt!: Date

    /** When the lot expires. */
    @Column({ name: "expires_at", type: "timestamptz" })
    expiresAt!: Date
}
