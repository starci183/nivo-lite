import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ConnectionsError, ConnectionsErrorCode, ConnectionsService } from "@modules/domain/connections"
import type { ConnectionActor, ConnectionRecord, Environment } from "@modules/domain/connections"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { bankNameOf } from "./bank-name.policy"
import { ChannelConnectionsLogEvent } from "./channel-connections.log-events"
import type {
    SepayConnectionView,
    SepayDeliveryRecord,
    SepayEventKind,
    SepayEventOutcome,
    SepayHealth,
    SepayIntake,
    SepayRawBody,
    SepayWebhookEvent,
} from "./sepay-connection.contracts"
import { maskApiKey, readSepayDelivery } from "./sepay-connection.policy"
import type { SepayEventRow, SepayStatsRow } from "./persistence/sepay-connection.rows"
import { INSERT_SEPAY_EVENT, LIST_SEPAY_EVENTS, SELECT_SEPAY_STATS } from "./persistence/sepay-connection.sql"

const MANAGER = ["owner", "manager"] as const
const OWNER = ["owner"] as const
const EVENT_LIMIT = 30

const outcomeOf = (value: string): SepayEventOutcome =>
    value === "duplicate" || value === "unauthorized" ? value : "accepted"

const kindOf = (value: string): SepayEventKind => (value === "credit" || value === "debit" ? value : "ping")

const environmentOf = (value: string): Environment => (value === "test" ? "test" : "live")

const eventOf = (row: SepayEventRow): SepayWebhookEvent => ({
    id: row.id,
    at: row.at,
    outcome: outcomeOf(row.outcome),
    kind: kindOf(row.kind),
    amountVnd: row.amount_vnd === null ? null : Number(row.amount_vnd),
    providerEventId: row.provider_event_id,
    environment: environmentOf(row.environment),
})

const healthOf = (row: SepayStatsRow | undefined): SepayHealth => ({
    lastWebhookAt: row?.last_at ?? null,
    validCount: Number(row?.valid_24h ?? 0),
    totalCount: Number(row?.total_24h ?? 0),
    duplicateCount: Number(row?.duplicate_24h ?? 0),
})

@Injectable()
/**
 * The page of one SePay connection: its read model (the webhook address, the API key masked, the account masked, the health of the
 * door and the checklist facts), the newest deliveries, the switch between test and live, and the memory of every delivery the
 * webhook door answers. The key and the full account number never leave this service.
 */
export class SepayConnectionService {
    constructor(
        private readonly connections: ConnectionsService,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** The read model of one SePay connection (owner or manager). */
    async read(actor: ConnectionActor, connectionId: string): Promise<SepayConnectionView> {
        await this.connections.authorize(actor, MANAGER)
        return this.view(await this.sepayOf(actor, connectionId))
    }

    /** The newest deliveries of a SePay connection, newest first (owner or manager). */
    async events(actor: ConnectionActor, connectionId: string): Promise<ReadonlyArray<SepayWebhookEvent>> {
        await this.connections.authorize(actor, MANAGER)
        const connection = await this.sepayOf(actor, connectionId)
        const rows = await this.entityManager.query<Array<SepayEventRow>>(LIST_SEPAY_EVENTS, [
            connection.workspaceId,
            connection.id,
            EVENT_LIMIT,
        ])
        return rows.map(eventOf)
    }

    /** Switches the connection between the SePay test mode and live (owner). Credits of a test connection are never booked. */
    async setEnvironment(
        actor: ConnectionActor,
        connectionId: string,
        environment: Environment,
    ): Promise<SepayConnectionView> {
        await this.connections.authorize(actor, OWNER)
        const connection = await this.sepayOf(actor, connectionId)
        await this.connections.patch(actor.workspaceId, connection.id, { environment })
        return this.view(await this.sepayOf(actor, connectionId))
    }

    /**
     * Answers a delivery whose API key was proven: remembers it, then runs the intake. A delivery that moves money is remembered
     * after the intake took it, so a failed intake that SePay retries is not shown as a repeat; one that moves none (SePay's test
     * ping) is remembered first, because the intake may refuse it.
     */
    async traceIntake(feed: string, rawBody: SepayRawBody, intake: SepayIntake): Promise<void> {
        const reading = readSepayDelivery(rawBody)
        if (reading.kind === "ping") await this.remember({ connectionId: feed, outcome: "accepted", ...reading })
        await intake()
        if (reading.kind !== "ping") await this.remember({ connectionId: feed, outcome: "accepted", ...reading })
    }

    /** Remembers a delivery whose API key was refused. */
    traceRefusal(feed: string): Promise<void> {
        return this.remember({
            connectionId: feed,
            outcome: "unauthorized",
            kind: "ping",
            amountVnd: null,
            providerEventId: null,
        })
    }

    /** Writes one delivery down; the page is telemetry, so a failure is logged and never fails the webhook. */
    private async remember(record: SepayDeliveryRecord): Promise<void> {
        try {
            await this.entityManager.query(INSERT_SEPAY_EVENT, [
                record.connectionId,
                record.outcome,
                record.kind,
                record.amountVnd,
                record.providerEventId,
            ])
        } catch (error) {
            this.logger.warn(ChannelConnectionsLogEvent.SepayEventNotRecorded, {
                connectionId: record.connectionId,
                reason: error instanceof Error ? error.name : "unknown",
            })
        }
    }

    private async sepayOf(actor: ConnectionActor, connectionId: string): Promise<ConnectionRecord> {
        const connection = await this.connections.get(actor.workspaceId, connectionId)
        if (connection.provider !== "sepay") {
            throw new ConnectionsError({ code: ConnectionsErrorCode.NotFound, params: { id: connectionId } })
        }
        return connection
    }

    private async view(connection: ConnectionRecord): Promise<SepayConnectionView> {
        const [secret, stats, agentIds] = await Promise.all([
            this.connections.readSecret(connection.id),
            this.entityManager.query<Array<SepayStatsRow>>(SELECT_SEPAY_STATS, [connection.workspaceId, connection.id]),
            this.connections.agentIds(connection.workspaceId, connection.id),
        ])
        const row = stats[0]
        return {
            id: connection.id,
            name: connection.name,
            status: connection.status,
            environment: connection.environment,
            lastError: connection.lastError,
            bankCode: connection.meta.bank_code ?? "",
            bank: bankNameOf(connection.meta.bank_code ?? ""),
            accountMasked: connection.meta.account_masked ?? "",
            hasFullAccount: (connection.meta.account_number ?? "") !== "",
            holder: connection.meta.account_holder ?? "",
            webhookUrl: this.connections.webhookUrl("sepay", connection.id),
            apiKeyMasked: maskApiKey(secret?.plain ?? ""),
            pingSeenAt: row?.ping_at ?? null,
            transactionSeenAt: row?.transaction_at ?? null,
            health: healthOf(row),
            agentIds,
        }
    }
}
