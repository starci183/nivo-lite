import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"

@Entity({ schema: "public", name: "loyalty_otps" })
/** One one-time code of the public points check, stored hashed. */
export class LoyaltyOtpEntity {
    /** The code. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The workspace that issued it. */
    @Column({ name: "workspace_id", type: "uuid" })
    workspaceId!: string

    /** The customer it was sent to. */
    @Column({ name: "customer_id", type: "uuid" })
    customerId!: string

    /** The hash of the code. */
    @Column({ name: "code_hash", type: "text" })
    codeHash!: string

    /** The wrong tries so far. */
    @Column({ name: "attempts", type: "integer", default: () => "0" })
    attempts!: number

    /** When the code stops working. */
    @Column({ name: "expires_at", type: "timestamptz" })
    expiresAt!: Date

    /** When it was used, null while unused. */
    @Column({ name: "used_at", type: "timestamptz", nullable: true })
    usedAt!: Date | null

    /** The creation time. */
    @Column({ name: "created_at", type: "timestamptz", default: () => "now()" })
    createdAt!: Date
}
