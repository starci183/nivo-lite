import { Injectable } from "@nestjs/common"
import { In, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { ConnectionSecretsErrorCode, ConnectionSecretsService } from "@modules/domain/connection-secrets"
import type { ConnectionSecret } from "@modules/domain/connection-secrets"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { ConnectionEntity } from "./persistence/entities"

/** The most Zalo connections one renewal pass reads. */
const DUE_ZALO_MAX = 500

@Injectable()
/**
 * Opens the credential of a connection by its id alone (a webhook door or a delivery holds nothing else): the connection's own facts
 * are read here, in its owner, and handed to the secrets capability, which never reads the connections table.
 */
export class ConnectionSecretReadsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly secrets: ConnectionSecretsService,
    ) {}

    /** The opened credential and webhook secret of a connection of the provider, or a refusal when it cannot be used. */
    async secretOf(
        connectionId: string,
        provider: string,
        manager: EntityManager = this.entityManager,
    ): Promise<Outcome<ConnectionSecret, ConnectionSecretsErrorCode>> {
        const row = await manager.findOne(ConnectionEntity, {
            select: { id: true, workspaceId: true, provider: true, status: true },
            where: { id: connectionId },
        })
        if (row === null) return refused(ConnectionSecretsErrorCode.NotFound)
        return this.secrets.openFor(
            { id: row.id, workspaceId: row.workspaceId, provider: row.provider, status: row.status },
            provider,
            manager,
        )
    }

    /** The bot token of the connection a Telegram conversation came in on, or a refusal when it is not that workspace's Telegram bot. */
    async botToken(workspaceId: string, connectionId: string): Promise<Outcome<string, ConnectionSecretsErrorCode>> {
        const secret = await this.secretOf(connectionId, "telegram")
        if (secret.kind !== "ok") return secret
        return secret.value.workspaceId === workspaceId
            ? ok(secret.value.credential)
            : refused(ConnectionSecretsErrorCode.NotFound)
    }

    /** The ids of the live Zalo connections whose access token ends before the horizon, soonest first. */
    async dueZalo(horizon: Date): Promise<ReadonlyArray<string>> {
        const expiring = await this.secrets.expiringBefore(horizon, DUE_ZALO_MAX)
        if (expiring.length === 0) return []
        const live = await this.entityManager.find(ConnectionEntity, {
            select: { id: true },
            where: { id: In([...expiring]), provider: "zalo_oa", status: Not("disconnected") },
            take: DUE_ZALO_MAX,
        })
        const liveIds = new Set(live.map((row) => row.id))
        return expiring.filter((id) => liveIds.has(id))
    }
}
