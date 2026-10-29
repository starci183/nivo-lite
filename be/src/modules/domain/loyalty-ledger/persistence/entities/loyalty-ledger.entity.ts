import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"
import type { ValueTransformer } from "typeorm"

/** Why the points of an entry moved. */
export type LoyaltyLedgerKind = "earn" | "redeem" | "expire" | "adjust"

/** Reads the bigint amount (text from the driver) as a number; the ledger counts whole VND. */
const amountTransformer: ValueTransformer = {
    to: (value: number | null | undefined) => value,
    from: (value: string | null): number | null => (value === null ? null : Number(value)),
}

@Entity({ schema: "public", name: "loyalty_ledger" })
/** One line of the append-only points ledger. */
export class LoyaltyLedgerEntity {
    /** The entry. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace that owns the entry. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The customer whose points moved (an id of the loyalty-customers capability). */
    @Column({ name: "customer_id", type: "uuid" })
    customerId!: string

    /** Why the points moved. */
    @Column({ name: "kind", type: "text" })
    kind!: LoyaltyLedgerKind

    /** The points added (positive) or taken (negative). */
    @Column({ name: "points", type: "integer" })
    points!: number

    /** The amount behind the entry, whole VND. */
    @Column({ name: "amount_vnd", type: "bigint", nullable: true, transformer: amountTransformer })
    amountVnd!: number | null

    /** The order behind an earn. */
    @Column({ name: "order_id", type: "uuid", nullable: true })
    orderId!: string | null

    /** The invoice behind an earn. */
    @Column({ name: "invoice_id", type: "uuid", nullable: true })
    invoiceId!: string | null

    /** The reward behind a redeem. */
    @Column({ name: "reward_id", type: "uuid", nullable: true })
    rewardId!: string | null

    /** The gate decision behind the entry. */
    @Column({ name: "work_item_id", type: "uuid", nullable: true })
    workItemId!: string | null

    /** The idempotency key, unique within the workspace. */
    @Column({ name: "ref", type: "text" })
    ref!: string

    /** Who moved the points. */
    @Column({ name: "by_name", type: "text", default: () => "'NIVO'::text" })
    byName!: string

    /** The explanation. */
    @Column({ name: "evidence", type: "text", nullable: true })
    evidence!: string | null

    /** When earned points expire. */
    @Column({ name: "expires_at", type: "timestamptz", nullable: true })
    expiresAt!: Date | null

    /** When the points moved. */
    @Column({ name: "occurred_at", type: "timestamptz", default: () => "now()" })
    occurredAt!: Date

    /** The creation time. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
