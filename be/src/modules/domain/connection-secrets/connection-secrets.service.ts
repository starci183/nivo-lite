import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ConnectionEntity } from "@modules/domain/connections/persistence/entities"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { InjectConnectionSecretsOptions } from "./connection-secrets.decorators"
import type { ConnectionSecret, OptionalSealedText, OptionalStoredSecret } from "./connection-secrets.contracts"
import type { ConnectionSecretsOptions } from "./connection-secrets.options"
import { ConnectionSecretsError, ConnectionSecretsErrorCode } from "./errors/connection-secrets.error"
import { ConnectionSecretEntity } from "./persistence/entities"

/** A connection with its sealed credential, as the joined read answers it. */
interface ConnectionSecretRead {
    /** The workspace the connection belongs to. */
    readonly workspaceId: string
    /** The provider key. */
    readonly provider: string
    /** The connection status. */
    readonly status: string
    /** The sealed credential. */
    readonly ciphertext: string
    /** The random secret of the connection's own webhook. */
    readonly webhookSecret: string
    /** When the access token ends. */
    readonly tokenExpiresAt: Date | null
}

const isConnectionSecretRead = (value: unknown): value is ConnectionSecretRead =>
    typeof value === "object" &&
    value !== null &&
    "workspaceId" in value &&
    typeof value.workspaceId === "string" &&
    "provider" in value &&
    typeof value.provider === "string" &&
    "status" in value &&
    typeof value.status === "string" &&
    "ciphertext" in value &&
    typeof value.ciphertext === "string" &&
    "webhookSecret" in value &&
    typeof value.webhookSecret === "string"

/** True when a row names the connection of a lease or a due credential. */
const hasConnectionId = (value: unknown): value is { readonly connectionId: string } =>
    typeof value === "object" && value !== null && "connectionId" in value && typeof value.connectionId === "string"
import { openSecret, parseTokenKey, randomSecret, sealSecret } from "./secret-cipher.policy"

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

    /**
     * Seals a credential with the connection key: for connection_secrets.ciphertext, and for every other per-workspace credential
     * a capability keeps sealed in its own row (a remote MCP connector's bearer), so there is one key and one cipher.
     */
    seal(plain: string): string {
        return sealSecret(this.key, plain)
    }

    /**
     * Refuses a connection key that does not open a credential already sealed in the database (a sample of it, or none):
     * CHANNEL_TOKEN_KEY is one key, set once and never overwritten, so a key that changed under stored credentials is a broken
     * custody, not a rotation. The apps call this before they serve; it fails with `CONNECTION_SECRETS_KEY_MISMATCH`.
     */
    assertOpens(sealed: OptionalSealedText): void {
        if (sealed === null || this.open(sealed).kind === "ok") return
        throw new ConnectionSecretsError({ code: ConnectionSecretsErrorCode.KeyMismatch })
    }

    /** Proves at boot that the connection key opens the credentials of connection_secrets (see `assertOpens`). */
    async assertKeyOpensStored(): Promise<void> {
        const row = await this.entityManager.findOne(ConnectionSecretEntity, {
            select: { ciphertext: true },
            where: {},
        })
        this.assertOpens(row?.ciphertext ?? null)
    }

    /** Opens a text `seal` sealed, or a refusal when it cannot be opened with the current key. */
    open(sealed: string): Outcome<string, ConnectionSecretsErrorCode> {
        try {
            return ok(openSecret(this.key, sealed))
        } catch (cause) {
            return refused(ConnectionSecretsErrorCode.Unreadable, { reason: String(cause) })
        }
    }

    /** The opened credential and webhook secret of a connection of the provider, or a refusal when it is missing, disconnected, of another provider or unreadable. */
    async secretOf(
        connectionId: string,
        provider: string,
        manager: EntityManager = this.entityManager,
    ): Promise<Outcome<ConnectionSecret, ConnectionSecretsErrorCode>> {
        const rows: ReadonlyArray<unknown> = await manager
            .createQueryBuilder(ConnectionSecretEntity, "s")
            .select("c.workspace_id", "workspaceId")
            .addSelect("c.provider", "provider")
            .addSelect("c.status", "status")
            .addSelect("s.ciphertext", "ciphertext")
            .addSelect("s.webhook_secret", "webhookSecret")
            .addSelect("s.token_expires_at", "tokenExpiresAt")
            .innerJoin(ConnectionEntity, "c", "c.id = s.connection_id")
            .where("s.connectionId = :connectionId", { connectionId })
            .limit(1)
            .getRawMany()
        const row = rows.find(isConnectionSecretRead)
        if (row?.provider !== provider || row.status === "disconnected") {
            return refused(ConnectionSecretsErrorCode.NotFound)
        }
        try {
            return ok({
                workspaceId: row.workspaceId,
                credential: openSecret(this.key, row.ciphertext),
                webhookSecret: row.webhookSecret,
                tokenExpiresAt: row.tokenExpiresAt?.toISOString() ?? null,
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
        if (expiresAt === undefined) {
            await this.entityManager.update(ConnectionSecretEntity, { connectionId }, { ciphertext: sealed })
        } else {
            await this.entityManager.update(
                ConnectionSecretEntity,
                { connectionId },
                { ciphertext: sealed, tokenExpiresAt: expiresAt, refreshLockUntil: null },
            )
        }
    }

    /** Seals and inserts the credential of a new connection, inside the caller's transaction when one is handed in. */
    async create(
        connectionId: string,
        plain: string,
        webhookSecret: string,
        manager: EntityManager = this.entityManager,
    ): Promise<void> {
        await manager.insert(ConnectionSecretEntity, {
            connectionId,
            ciphertext: sealSecret(this.key, plain),
            webhookSecret,
        })
    }

    /** The opened credential of a connection, or null when it has none; throws when it cannot be opened with the current key. */
    async read(connectionId: string): Promise<OptionalStoredSecret> {
        const row = await this.entityManager.findOne(ConnectionSecretEntity, {
            select: { ciphertext: true, webhookSecret: true },
            where: { connectionId },
        })
        return row === null ? null : { plain: openSecret(this.key, row.ciphertext), webhookSecret: row.webhookSecret }
    }

    /** Seals and stores the credential; the webhook secret changes only when one is given (a new row gets a random one). */
    async write(connectionId: string, plain: string, webhookSecret?: string): Promise<void> {
        await this.entityManager
            .createQueryBuilder(ConnectionSecretEntity, "cs")
            .insert()
            .values({
                connectionId,
                ciphertext: sealSecret(this.key, plain),
                webhookSecret: webhookSecret ?? randomSecret(),
            })
            .orUpdate(webhookSecret === undefined ? ["ciphertext"] : ["ciphertext", "webhook_secret"], [
                "connection_id",
            ])
            .execute()
    }

    /** Deletes the stored credential of a connection. */
    async wipe(connectionId: string): Promise<void> {
        await this.entityManager.delete(ConnectionSecretEntity, { connectionId })
    }

    /** Takes the refresh lease when nobody holds a live one; false when another caller has it. */
    async takeLease(connectionId: string, until: Date, now: Date): Promise<boolean> {
        const taken = await this.entityManager
            .createQueryBuilder(ConnectionSecretEntity, "cs")
            .update()
            .set({ refreshLockUntil: until })
            .where("connection_id = :connectionId AND (refresh_lock_until IS NULL OR refresh_lock_until < :now)", {
                connectionId,
                now,
            })
            .returning('connection_id AS "connectionId"')
            .execute()
        return Array.isArray(taken.raw) && taken.raw.some(hasConnectionId)
    }

    /** Drops the refresh lease. */
    async releaseLease(connectionId: string): Promise<void> {
        await this.entityManager.update(ConnectionSecretEntity, { connectionId }, { refreshLockUntil: null })
    }

    /** The ids of the Zalo connections whose access token ends before the horizon, soonest first. */
    async dueZalo(horizon: Date): Promise<ReadonlyArray<string>> {
        const rows: ReadonlyArray<unknown> = await this.entityManager
            .createQueryBuilder(ConnectionSecretEntity, "s")
            .select("s.connection_id", "connectionId")
            .innerJoin(ConnectionEntity, "c", "c.id = s.connection_id")
            .where("c.provider = 'zalo_oa' AND c.status <> 'disconnected'")
            .andWhere("s.token_expires_at IS NOT NULL AND s.token_expires_at < :horizon", { horizon })
            .orderBy("s.token_expires_at")
            .limit(500)
            .getRawMany()
        return rows.filter(hasConnectionId).map((row) => row.connectionId)
    }
}
