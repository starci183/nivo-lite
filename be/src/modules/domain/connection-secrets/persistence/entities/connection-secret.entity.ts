import { AbstractEntity } from "@modules/platform/database"
import { Column, Entity, PrimaryColumn } from "typeorm"

@Entity({ schema: "public", name: "connection_secrets" })
/** One row of public.connection_secrets: the sealed credential of a connection. */
export class ConnectionSecretEntity extends AbstractEntity {
    /** The connection the credential belongs to. */
    @PrimaryColumn({ name: "connection_id", type: "uuid" })
    connectionId!: string

    /** The sealed credential. */
    @Column({ name: "ciphertext", type: "text" })
    ciphertext!: string

    /** The sealed API token NIVO presents to the provider; null when none was given. */
    @Column({ name: "api_token_ciphertext", type: "text", nullable: true })
    apiTokenCiphertext!: string | null

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
