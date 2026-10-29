import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "connection_secrets" })
/** One row of public.connection_secrets: the sealed credential of a connection. */
export class ConnectionSecretEntity {
    /** The connection the credential belongs to. */
    @PrimaryColumn({ name: "connection_id", type: "uuid" })
    connectionId!: string

    /** The sealed credential. */
    @Column({ name: "ciphertext", type: "text" })
    ciphertext!: string

    /** The random secret of the connection's own webhook. */
    @Column({ name: "webhook_secret", type: "text" })
    webhookSecret!: string

    /** When the access token ends. */
    @Column({ name: "token_expires_at", type: "timestamptz", nullable: true })
    tokenExpiresAt!: Date | null

    /** Until when a refresh lease holds the single-use refresh token. */
    @Column({ name: "refresh_lock_until", type: "timestamptz", nullable: true })
    refreshLockUntil!: Date | null
}
