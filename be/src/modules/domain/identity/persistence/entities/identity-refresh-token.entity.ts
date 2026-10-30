import { UuidAbstractEntity } from "@modules/platform/database"
import { Column, Entity } from "typeorm"

@Entity({ schema: "public", name: "identity_refresh_tokens" })
/** One refresh token of a device session; only its digest is stored, and a spent token is kept for replay detection. */
export class IdentityRefreshTokenEntity extends UuidAbstractEntity {
    /** The device session the token belongs to. */
    @Column({ name: "session_id", type: "uuid" })
    sessionId!: string

    /** The account the session belongs to. */
    @Column({ name: "user_id", type: "uuid" })
    userId!: string

    /** The digest of the token, unique. */
    @Column({ name: "token_hash", type: "text" })
    tokenHash!: string

    /** When the token stops working. */
    @Column({ name: "expires_at", type: "timestamptz" })
    expiresAt!: Date

    /** When the token was rotated away, or null while it is the live one. */
    @Column({ name: "used_at", type: "timestamptz", nullable: true })
    usedAt!: Date | null
}
