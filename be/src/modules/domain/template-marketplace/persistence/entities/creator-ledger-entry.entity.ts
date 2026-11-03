import { Column, Entity } from "typeorm"
import { UuidAbstractEntity } from "@modules/platform/database"

const vnd = { to: (value: number): number => value, from: (value: string): number => Number(value) }

@Entity({ schema: "public", name: "creator_ledger_entries" })
/** One line of what a creator is owed: written once from a paid order and never changed. */
export class CreatorLedgerEntryEntity extends UuidAbstractEntity {
    /** The creator account. */
    @Column({ name: "creator_account_id", type: "uuid" })
    creatorAccountId!: string

    /** The template key. */
    @Column({ name: "template_key", type: "text" })
    templateKey!: string

    /** The listing sold. */
    @Column({ name: "listing_id", type: "uuid", nullable: true })
    listingId!: string | null

    /** The paid order. */
    @Column({ name: "order_id", type: "uuid" })
    orderId!: string

    /** The workspace that paid. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The creator share, or the fee of the platform. */
    @Column({ name: "kind", type: "text" })
    kind!: "creator_share" | "platform_fee"

    /** The amount in VND. */
    @Column({ name: "amount_vnd", type: "bigint", transformer: vnd })
    amountVnd!: number
}
