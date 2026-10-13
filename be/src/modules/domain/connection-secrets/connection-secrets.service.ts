import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { InjectConnectionSecretsOptions } from "./connection-secrets.decorators"
import type { ConnectionSecret } from "./connection-secrets.contracts"
import type { ConnectionSecretsOptions } from "./connection-secrets.options"
import { ConnectionSecretsError, ConnectionSecretsErrorCode } from "./errors/connection-secrets.error"
import type { ConnectionIdRow, ConnectionSecretRow } from "./persistence/connection-secrets.rows"
import {
    FIND_CONNECTION_SECRET,
    LIST_ZALO_CONNECTIONS_DUE,
    RELEASE_REFRESH_LEASE,
    SAVE_SECRET,
    SAVE_SECRET_WITH_EXPIRY,
    TRY_REFRESH_LEASE,
} from "./persistence/connection-secrets.sql"
import { openSecret, parseTokenKey, sealSecret } from "./secret-cipher.policy"

@Injectable()
/** Seals and opens the credential of a connection and keeps its token lease; the only reader and writer of connection_secrets. */
export class ConnectionSecretsService {
    private readonly key: Buffer

    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectConnectionSecretsOptions() options: ConnectionSecretsOptions,
    ) {
        const key = parseTokenKey(options.tokenKey.reveal())
        if (key.length === 0) throw new ConnectionSecretsError({ code: ConnectionSecretsErrorCode.KeyInvalid })
        this.key = key
    }

    /** Seals a credential for storage in connection_secrets.ciphertext. */
    seal(plain: string): string {
        return sealSecret(this.key, plain)
    }

    /** The opened credential and webhook secret of a connection of the provider, or a refusal when it is missing, disconnected, of another provider or unreadable. */
    async secretOf(
        connectionId: string,
        provider: string,
        manager: EntityManager = this.entityManager,
    ): Promise<Outcome<ConnectionSecret, ConnectionSecretsErrorCode>> {
        const row = (await manager.query<Array<ConnectionSecretRow>>(FIND_CONNECTION_SECRET, [connectionId]))[0]
        if (row === undefined || row.provider !== provider || row.status === "disconnected") {
            return refused(ConnectionSecretsErrorCode.NotFound)
        }
        try {
            return ok({
                workspaceId: row.workspace_id,
                credential: openSecret(this.key, row.ciphertext),
                webhookSecret: row.webhook_secret,
                tokenExpiresAt: row.token_expires_at,
            })
        } catch (cause) {
            return refused(ConnectionSecretsErrorCode.Unreadable, { reason: String(cause) })
        }
    }

    /** The bot token of the connection a Telegram conversation came in on, or a refusal when the connection is not that workspace's Telegram bot. */
    async botToken(workspaceId: string, connectionId: string): Promise<Outcome<string, ConnectionSecretsErrorCode>> {
        const secret = await this.secretOf(connectionId, "telegram")
        if (secret.kind !== "ok") return secret
        return secret.value.workspaceId === workspaceId
            ? ok(secret.value.credential)
            : refused(ConnectionSecretsErrorCode.NotFound)
    }

    /** Replaces the sealed credential; with an expiry it also records the end of the access token and drops the refresh lease. */
    async save(connectionId: string, sealed: string, expiresAt?: Date): Promise<void> {
        if (expiresAt === undefined) await this.entityManager.query(SAVE_SECRET, [connectionId, sealed])
        else await this.entityManager.query(SAVE_SECRET_WITH_EXPIRY, [connectionId, sealed, expiresAt])
    }

    /** Takes the refresh lease when nobody holds a live one; false when another caller has it. */
    async takeLease(connectionId: string, until: Date, now: Date): Promise<boolean> {
        const rows = await this.entityManager.query<Array<ConnectionIdRow>>(TRY_REFRESH_LEASE, [
            connectionId,
            until,
            now,
        ])
        return rows.length > 0
    }

    /** Drops the refresh lease. */
    async releaseLease(connectionId: string): Promise<void> {
        await this.entityManager.query(RELEASE_REFRESH_LEASE, [connectionId])
    }

    /** The ids of the Zalo connections whose access token ends before the horizon, soonest first. */
    async dueZalo(horizon: Date): Promise<ReadonlyArray<string>> {
        const rows = await this.entityManager.query<Array<ConnectionIdRow>>(LIST_ZALO_CONNECTIONS_DUE, [horizon])
        return rows.map((row) => row.connection_id)
    }
}
