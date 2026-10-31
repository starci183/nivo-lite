import { Injectable } from "@nestjs/common"
import { In, Not } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    ConnectionOwner,
    HealthCandidate,
    HealthMark,
    OptionalConnectionId,
    Provider,
    SyncFacts,
    SyncInterval,
    SyncSchedule,
} from "./connections.contracts"
import { ConnectionsError, ConnectionsErrorCode } from "./errors/connections.error"
import { isoText, returnedIds, returnedOwners } from "./persistence/connection.projection"
import { ConnectionEntity } from "./persistence/entities"

/** The id every real id sorts after. */
const NIL_UUID = "00000000-0000-0000-0000-000000000000"

@Injectable()
/** The upkeep of connections: the health check, the sync schedule and the workspace default SMTP. */
export class ConnectionsUpkeepService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /**
     * A page of the connections the health check judges, in id order, after the given id (empty for the first page).
     */
    healthBatch(afterId: string, size: number): Promise<ReadonlyArray<HealthCandidate>> {
        return this.entityManager
            .createQueryBuilder(ConnectionEntity, "c")
            .select("c.id", "id")
            .addSelect("c.workspace_id", "workspaceId")
            .addSelect("c.provider", "provider")
            .addSelect("c.name", "name")
            .addSelect("c.status", "status")
            .addSelect("coalesce(c.last_error, '')", "lastError")
            .addSelect("coalesce(c.last_event_at::text, '')", "lastEventAt")
            .addSelect("c.created_at::text", "createdAt")
            .addSelect("coalesce(c.public_meta -> 'health' ->> 'state', '')", "health")
            .where("c.status <> 'disconnected' AND c.id > :afterId", { afterId: afterId === "" ? NIL_UUID : afterId })
            .orderBy("c.id")
            .limit(size)
            .getRawMany<HealthCandidate>()
    }

    /** Records the health verdict in the public facts of the connection. */
    async markHealth(connectionId: string, mark: HealthMark): Promise<void> {
        await this.entityManager
            .createQueryBuilder(ConnectionEntity, "co")
            .update()
            .set({ publicMeta: () => "jsonb_set(public_meta, '{health}', :verdict::jsonb)" })
            .where({ id: connectionId })
            .setParameter(
                "verdict",
                JSON.stringify({ state: mark.state, reason: mark.reason, checked_at: mark.checkedAt }),
            )
            .execute()
    }

    /**
     * How often a connection of the workspace syncs by itself and when it last did; a missing one is a typed not-
     * found.
     */
    async scheduleOf(workspaceId: string, id: string): Promise<SyncSchedule> {
        const row = await this.entityManager
            .createQueryBuilder(ConnectionEntity, "c")
            .select("c.sync_every_minutes", "everyMinutes")
            .addSelect(isoText("c.last_sync_at"), "lastSyncAt")
            .where("c.workspaceId = :workspaceId AND c.id = :id", { workspaceId, id })
            .limit(1)
            .getRawOne<SyncSchedule>()
        if (row === undefined) throw new ConnectionsError({ code: ConnectionsErrorCode.NotFound, params: { id } })
        return { everyMinutes: row.everyMinutes, lastSyncAt: row.lastSyncAt }
    }

    /** Sets how often a connection syncs by itself (null is manual only); the first scheduled sync is due at once. */
    async setSchedule(workspaceId: string, id: string, everyMinutes: SyncInterval): Promise<void> {
        const updated = await this.entityManager
            .createQueryBuilder(ConnectionEntity, "co")
            .update()
            .set({
                syncEveryMinutes: () => ":minutes::int",
                nextSyncAt: () => "CASE WHEN :minutes::int IS NULL THEN NULL ELSE now() END",
            })
            .where({ workspaceId, id })
            .setParameter("minutes", everyMinutes)
            .returning("id")
            .execute()
        if (returnedIds(updated.raw).length === 0) {
            throw new ConnectionsError({ code: ConnectionsErrorCode.NotFound, params: { id } })
        }
    }

    /**
     * A sync finished: the connection works, the next sync is scheduled and the given public facts join the old ones.
     */
    async markSynced(connectionId: string, facts: SyncFacts): Promise<void> {
        await this.entityManager
            .createQueryBuilder(ConnectionEntity, "co")
            .update()
            .set({
                status: "connected",
                lastError: null,
                lastSyncAt: () => "now()",
                lastEventAt: () => "now()",
                nextSyncAt: () =>
                    "CASE WHEN sync_every_minutes IS NULL THEN NULL ELSE now() + make_interval(mins => sync_every_minutes) END",
                publicMeta: () => "jsonb_concat(public_meta, CAST(:facts AS jsonb))",
            })
            .where({ id: connectionId })
            .setParameter("facts", JSON.stringify(facts))
            .execute()
    }

    /** A sync failed: the owner reads the reason and the retry waits at least a quarter of an hour. */
    async markSyncFailed(connectionId: string, reason: string): Promise<void> {
        await this.entityManager.update(
            ConnectionEntity,
            { id: connectionId },
            {
                status: "error",
                lastError: reason,
                nextSyncAt: () =>
                    "CASE WHEN sync_every_minutes IS NULL THEN NULL ELSE now() + make_interval(mins => GREATEST(sync_every_minutes, 15)) END",
            },
        )
    }

    /**
     * Claims the connections of these providers whose scheduled sync is due, soonest first; their next sync moves half
     * an hour on until the sync sets the real time.
     */
    claimDueSyncs(providers: ReadonlyArray<Provider>, size: number): Promise<ReadonlyArray<ConnectionOwner>> {
        return this.entityManager.transaction(async (tx) => {
            const due = await tx
                .createQueryBuilder(ConnectionEntity, "c")
                .select("c.id", "id")
                .where(
                    "c.provider = ANY(:providers) AND c.status <> 'disconnected' AND c.next_sync_at IS NOT NULL AND c.next_sync_at <= now()",
                    { providers: [...providers] },
                )
                .orderBy("c.next_sync_at")
                .limit(size)
                .setLock("pessimistic_write")
                .setOnLocked("skip_locked")
                .getRawMany<{ id: string }>()
            if (due.length === 0) return []
            const claimed = await tx
                .createQueryBuilder(ConnectionEntity, "co")
                .update()
                .set({ nextSyncAt: () => "now() + interval '30 minutes'" })
                .where({ id: In(due.map((row) => row.id)) })
                .returning("id, workspace_id")
                .execute()
            return returnedOwners(claimed.raw)
        })
    }

    /** Makes one SMTP connection the workspace default; every other one becomes a spare. */
    async setDefaultSmtp(workspaceId: string, id: string): Promise<void> {
        await this.entityManager
            .createQueryBuilder(ConnectionEntity, "co")
            .update()
            .set({ isDefault: () => "(id = :id)" })
            .where("workspace_id = :workspaceId AND provider = 'smtp' AND (is_default OR id = :id)", {
                workspaceId,
                id,
            })
            .execute()
    }

    /** The id of the workspace default SMTP connection, or null when it has none. */
    async defaultSmtpId(workspaceId: string): Promise<OptionalConnectionId> {
        const row = await this.entityManager.findOne(ConnectionEntity, {
            where: { workspaceId, provider: "smtp", isDefault: true, status: Not("disconnected") },
            select: { id: true },
        })
        return row === null ? null : row.id
    }
}
