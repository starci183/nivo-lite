import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionActor } from "@modules/domain/connections"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { DomainError } from "@modules/platform/errors"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DataSyncQueue } from "@modules/queues/data-sync"
import type { DataSyncPayload } from "@modules/queues/data-sync"
import { CsvImportSyncService } from "./csv-import-sync.service"
import { DATA_PROVIDERS } from "./data-hub.contracts"
import type { DataConnector, DataProvider, DataSyncRun, DataSyncTrigger } from "./data-hub.contracts"
import { DataHubLogEvent } from "./data-hub.log-events"
import { toDataSyncRun } from "./data-hub.mapper"
import { DataHubService } from "./data-hub.service"
import { DataRecordsService } from "./data-records.service"
import { DatabaseSyncService } from "./database-sync.service"
import { DataHubError, DataHubErrorCode } from "./errors/data-hub.error"
import { ImapSyncService } from "./imap-sync.service"
import { OpenApiSyncService } from "./openapi-sync.service"
import type { DataRunIdRow, DataSyncRunRow } from "./persistence/data-hub.rows"
import { FIND_LATEST_SYNC_RUN, FIND_SYNC_RUN, FINISH_SYNC_RUN, INSERT_SYNC_RUN } from "./persistence/data-hub.sql"
import { TelegramUserSyncService } from "./telegram-user-sync.service"

/** How long one sync may run before it stops early and the next one continues. */
const SYNC_BUDGET_MS = 120_000
/** How many due scheduled syncs one tick queues. */
const DUE_PER_TICK = 20
const REASON_MAX = 500

@Injectable()
/** Runs the syncs of a workspace's own systems into the hub, records each run, and queues the manual and the scheduled ones. */
export class DataSyncService {
    private readonly connectors: ReadonlyMap<DataProvider, DataConnector>

    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
        private readonly queue: DataSyncQueue,
        private readonly connections: ConnectionsService,
        private readonly hub: DataHubService,
        private readonly records: DataRecordsService,
        csv: CsvImportSyncService,
        database: DatabaseSyncService,
        imap: ImapSyncService,
        openapi: OpenApiSyncService,
        telegramUser: TelegramUserSyncService,
    ) {
        this.connectors = new Map<DataProvider, DataConnector>(
            [csv, database, imap, openapi, telegramUser].map((connector) => [connector.provider, connector]),
        )
    }

    /** "Sync now" (owner): opens a run and queues the job that does it; the run is what the owner then polls. */
    async request(actor: ConnectionActor, connectionId: string): Promise<DataSyncRun> {
        await this.hub.owner(actor)
        await this.hub.own(actor.workspaceId, connectionId)
        return this.entityManager.transaction(async (tx) => {
            const run = await this.open(tx, actor.workspaceId, connectionId, "manual")
            await this.queue.enqueueSync({ workspaceId: actor.workspaceId, connectionId, runId: run.id }, tx)
            return run
        })
    }

    /** One run of the workspace (owner); a missing one is a typed not-found. */
    async status(actor: ConnectionActor, runId: string): Promise<DataSyncRun> {
        await this.hub.owner(actor)
        const [row] = await this.entityManager.query<Array<DataSyncRunRow>>(FIND_SYNC_RUN, [actor.workspaceId, runId])
        if (row === undefined) throw new DataHubError({ code: DataHubErrorCode.NotFound })
        return toDataSyncRun(row)
    }

    /** The latest run of a connection of the workspace (owner), or null when it never synced. */
    async latest(actor: ConnectionActor, connectionId: string): Promise<DataSyncRun | null> {
        await this.hub.owner(actor)
        await this.hub.own(actor.workspaceId, connectionId)
        const [row] = await this.entityManager.query<Array<DataSyncRunRow>>(FIND_LATEST_SYNC_RUN, [
            actor.workspaceId,
            connectionId,
        ])
        return row === undefined ? null : toDataSyncRun(row)
    }

    /** Queues one sync for every connection whose scheduled sync is due (the minute tick). */
    async queueDue(): Promise<number> {
        const due = await this.connections.claimDueSyncs(DATA_PROVIDERS, DUE_PER_TICK)
        for (const connection of due) {
            await this.entityManager.transaction(async (tx) => {
                const run = await this.open(tx, connection.workspaceId, connection.id, "schedule")
                await this.queue.enqueueSync(
                    { workspaceId: connection.workspaceId, connectionId: connection.id, runId: run.id },
                    tx,
                )
            })
        }
        return due.length
    }

    /** Runs one queued sync: reads the owner's system into the hub, then settles the run and the connection. A failure is recorded, never thrown. */
    async run(payload: DataSyncPayload): Promise<void> {
        let rows = 0
        try {
            const connection = await this.hub.own(payload.workspaceId, payload.connectionId)
            const connector = this.connectors.get(connection.provider)
            if (connector === undefined) throw new DataHubError({ code: DataHubErrorCode.NotFound })
            const deadline = this.clock.now().getTime() + SYNC_BUDGET_MS
            const result = await connector.sync({
                connection,
                credential: (await this.hub.credentialOf(connection.id)) ?? "",
                upsert: async (entity, list) => {
                    const written = await this.records.upsert(connection.workspaceId, connection.id, entity, list)
                    rows += written
                    return written
                },
                isExpired: () => this.clock.now().getTime() >= deadline,
            })
            await this.connections.markSynced(connection.id, result.meta ?? {})
            await this.finish(payload.runId, "ok", result.rows, null)
        } catch (cause) {
            const reason = this.reasonOf(cause)
            await this.connections
                .markSyncFailed(payload.connectionId, reason)
                .catch((failure: unknown) => this.logger.error(DataHubLogEvent.SyncCrashed, failure, { ...payload }))
            await this.finish(payload.runId, "failed", rows, reason)
        }
    }

    /** Settles the run of a job that ran out of attempts, so the owner stops waiting. */
    abandon(runId: string): Promise<void> {
        return this.finish(runId, "failed", 0, this.catalog.get("errors.DATA_HUB_SYNC_FAILED", {}, "vi"))
    }

    private async open(
        tx: EntityManager,
        workspaceId: string,
        connectionId: string,
        trigger: DataSyncTrigger,
    ): Promise<DataSyncRun> {
        const [created] = await tx.query<Array<DataRunIdRow>>(INSERT_SYNC_RUN, [workspaceId, connectionId, trigger])
        if (created === undefined) throw new DataHubError({ code: DataHubErrorCode.SyncFailed })
        const [row] = await tx.query<Array<DataSyncRunRow>>(FIND_SYNC_RUN, [workspaceId, created.id])
        if (row === undefined) throw new DataHubError({ code: DataHubErrorCode.SyncFailed })
        return toDataSyncRun(row)
    }

    private async finish(runId: string, state: "ok" | "failed", rows: number, error: string | null): Promise<void> {
        await this.entityManager.query(FINISH_SYNC_RUN, [runId, state, rows, error])
    }

    /** The sentence the owner reads for a failed sync: the refusal's own text, or a general one for anything unexpected (which is logged). */
    private reasonOf(cause: unknown): string {
        if (cause instanceof DomainError) {
            return this.catalog.get(`errors.${cause.code}`, cause.params, "vi").slice(0, REASON_MAX)
        }
        this.logger.error(DataHubLogEvent.SyncCrashed, cause, {})
        return this.catalog.get("errors.DATA_HUB_SYNC_FAILED", {}, "vi")
    }
}
