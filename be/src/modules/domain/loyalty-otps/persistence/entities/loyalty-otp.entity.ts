import { Column, Entity } from "typeorm"

import { UuidAbstractEntity } from "@modules/platform/database"

@Entity({ schema: "public", name: "loyalty_otps" })
/** One one-time code of the public points check, stored hashed. */
export class LoyaltyOtpEntity extends UuidAbstractEntity {
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
}
