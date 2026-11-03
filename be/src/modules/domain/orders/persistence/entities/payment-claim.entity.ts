import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"
import { bigintNumberTransformer } from "@modules/platform/primitives"
import type { PaymentClaimStatus } from "../../orders.contracts"

@Entity({ schema: "public", name: "payment_claims" })
/** One customer's claim that they paid an order: one row of `public.payment_claims`. */
export class PaymentClaimEntity extends UuidAbstractEntity {
    /** The workspace. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The customer who said it. */
    @Column({ name: "lead_id", type: "uuid", nullable: true })
    leadId!: string | null

    /** The conversation it was said in. */
    @Column({ name: "conversation_id", type: "uuid", nullable: true })
    conversationId!: string | null

    /** The amount named in VND. */
    @Column({ name: "amount_vnd", type: "bigint", nullable: true, transformer: bigintNumberTransformer })
    amountVnd!: number | null

    /** The names the customer gave. */
    @Column({ name: "names", type: "text", array: true, default: () => "'{}'::text[]" })
    names!: Array<string>

    /** The customer's own words. */
    @Column({ name: "body", type: "text" })
    body!: string

    /** When it was said. */
    @Column({ name: "claimed_at", type: "timestamptz", default: () => "now()" })
    claimedAt!: Date

    /** Where it stands, a member of the table check. */
    @Column({ name: "status", type: "text", default: () => "'open'" })
    status!: PaymentClaimStatus

    /** The transaction that settled it, or null. */
    @Column({ name: "settled_transaction_id", type: "uuid", nullable: true })
    settledTransactionId!: string | null

    /** What makes a repeated message one claim. */
    @Column({ name: "dedupe_key", type: "text" })
    dedupeKey!: string
}
