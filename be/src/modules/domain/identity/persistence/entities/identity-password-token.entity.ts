import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"
import type { PasswordPurpose } from "../../identity-auth.contracts"

@Entity({ schema: "public", name: "identity_password_tokens" })
/** One single-use link token (reset, invite or confirm); only its digest is stored. */
export class IdentityPasswordTokenEntity {
    /** The token id. */
    @PrimaryGeneratedColumn("uuid", { name: "id" })
    id!: string

    /** The account the link is for. */
    @Column({ name: "user_id", type: "uuid" })
    userId!: string

    /** The digest of the token, unique. */
    @Column({ name: "token_hash", type: "text" })
    tokenHash!: string

    /** What the link does: reset, invite or confirm. */
    @Column({ name: "purpose", type: "text" })
    purpose!: PasswordPurpose

    /** When the token was issued. */
    @Column({ name: "created_at", type: "timestamptz" })
    createdAt!: Date

    /** When the token stops working. */
    @Column({ name: "expires_at", type: "timestamptz" })
    expiresAt!: Date

    /** When the token was spent, or null while it is unused. */
    @Column({ name: "used_at", type: "timestamptz", nullable: true })
    usedAt!: Date | null
}
