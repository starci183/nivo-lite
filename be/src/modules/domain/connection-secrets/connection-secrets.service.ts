import { Injectable } from "@nestjs/common"
import { LessThan } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { InjectConnectionSecretsOptions } from "./connection-secrets.decorators"
import type {
    ConnectionSecret,
    ConnectionSecretFacts,
    OptionalSealedText,
    OptionalStoredSecret,
} from "./connection-secrets.contracts"
import type { ConnectionSecretsOptions } from "./connection-secrets.options"
import { ConnectionSecretsError, ConnectionSecretsErrorCode } from "./errors/connection-secrets.error"
import { ConnectionSecretEntity } from "./persistence/entities"

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

    /**
     * The opened credential and webhook secret of a connection of the provider, or a refusal when the connection is of another provider,
     * disconnected, has no secret row or its secret is unreadable. The connection's own facts come from its owner (the caller reads
     * them), so this capability never reads the connections table.
     */
    async openFor(
        facts: ConnectionSecretFacts,
        provider: string,
        manager: EntityManager = this.entityManager,
    ): Promise<Outcome<ConnectionSecret, ConnectionSecretsErrorCode>> {
        if (facts.provider !== provider || facts.status === "disconnected") {
            return refused(ConnectionSecretsErrorCode.NotFound)
        }
        const row = await manager.findOne(ConnectionSecretEntity, {
            select: { ciphertext: true, webhookSecret: true, tokenExpiresAt: true },
            where: { connectionId: facts.id },
        })
        if (row === null) return refused(ConnectionSecretsErrorCode.NotFound)
        try {
            return ok({
                workspaceId: facts.workspaceId,
                credential: openSecret(this.key, row.ciphertext),
                webhookSecret: row.webhookSecret,
                tokenExpiresAt: row.tokenExpiresAt?.toISOString() ?? null,
            })
        } catch (cause) {
            return refused(ConnectionSecretsErrorCode.Unreadable, { reason: String(cause) })
        }
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
            select: { ciphertext: true, webhookSecret: true, updatedAt: true },
            where: { connectionId },
        })
        return row === null
            ? null
            : {
                  plain: openSecret(this.key, row.ciphertext),
                  webhookSecret: row.webhookSecret,
                  sealedAt: row.updatedAt.toISOString(),
              }
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

    /** The ids of the connections whose access token ends before the horizon, soonest first, at most `limit`. */
    async expiringBefore(horizon: Date, limit: number): Promise<ReadonlyArray<string>> {
        const rows = await this.entityManager.find(ConnectionSecretEntity, {
            select: { connectionId: true },
            where: { tokenExpiresAt: LessThan(horizon) },
            order: { tokenExpiresAt: "ASC" },
            take: limit,
        })
        return rows.map((row) => row.connectionId)
    }
}
