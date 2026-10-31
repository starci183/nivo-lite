import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { randomSecret } from "@modules/domain/connection-secrets"
import { ConnectionsError, ConnectionsErrorCode, ConnectionsService, sha256 } from "@modules/domain/connections"
import type { ConnectionActor, ConnectionRecord, Environment } from "@modules/domain/connections"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { bankNameOf } from "./bank-name.policy"
import type { SepayKeyReveal } from "./channel-connections.contracts"
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
import { ChannelConnectionsSepayEventEntity } from "./persistence/entities"

/** The instant shape the page always showed: UTC, millisecond precision, a trailing Z. */
const UTC_MS = `'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'`

/** One remembered SePay delivery as the query answers it: the instant is ISO text. */
interface SepayEventRead {
    /** The row id. */
    readonly id: string
    /** When it arrived, ISO text. */
    readonly at: string
    /** `accepted`, `duplicate` or `unauthorized`. */
    readonly outcome: string
    /** `credit`, `debit` or `ping`. */
    readonly kind: string
    /** The amount in VND; null for a ping or a refused key. */
    readonly amountVnd: string | null
    /** The SePay transaction id; null when none. */
    readonly providerEventId: string | null
    /** `test` or `live`. */
    readonly environment: string
}

/** The health counters of one SePay connection as the query answers them (counts arrive as text). */
interface SepayStatsRead {
    /** When the last delivery arrived (any outcome), ISO text. */
    readonly lastAt: string | null
    /** When the last SePay ping arrived, ISO text. */
    readonly pingAt: string | null
    /** When the last transaction arrived, ISO text. */
    readonly transactionAt: string | null
    /** Deliveries in the last 24 hours. */
    readonly total24h: string
    /** Deliveries in the last 24 hours whose API key was valid. */
    readonly valid24h: string
    /** Repeated deliveries in the last 24 hours. */
    readonly duplicate24h: string
}

const EVENT_FIELDS: ReadonlyArray<string> = ["id", "at", "outcome", "kind", "environment"]

const isEventRead = (value: unknown): value is SepayEventRead =>
    typeof value === "object" &&
    value !== null &&
    EVENT_FIELDS.every((field) => typeof Reflect.get(value, field) === "string")

const isStatsRead = (value: unknown): value is SepayStatsRead =>
    typeof value === "object" && value !== null && "total24h" in value && "valid24h" in value && "duplicate24h" in value

/** The connection a delivery belongs to, as the scalar the inserted column takes; an unknown connection leaves it null and stores nothing. */
const ofSepayFeed =
    (column: string): (() => string) =>
    () =>
        `(SELECT c.${column} FROM public.connections c WHERE c.id = :connectionId AND c.provider = 'sepay')`

const MANAGER = ["owner", "manager"] as const
const OWNER = ["owner"] as const
const EVENT_LIMIT = 30

const outcomeOf = (value: string): SepayEventOutcome =>
    value === "duplicate" || value === "unauthorized" ? value : "accepted"

const kindOf = (value: string): SepayEventKind => (value === "credit" || value === "debit" ? value : "ping")

const environmentOf = (value: string): Environment => (value === "test" ? "test" : "live")

const eventOf = (row: SepayEventRead): SepayWebhookEvent => ({
    id: row.id,
    at: row.at,
    outcome: outcomeOf(row.outcome),
    kind: kindOf(row.kind),
    amountVnd: row.amountVnd === null ? null : Number(row.amountVnd),
    providerEventId: row.providerEventId,
    environment: environmentOf(row.environment),
})

const healthOf = (row: SepayStatsRead | undefined): SepayHealth => ({
    lastWebhookAt: row?.lastAt ?? null,
    validCount: Number(row?.valid24h ?? 0),
    totalCount: Number(row?.total24h ?? 0),
    duplicateCount: Number(row?.duplicate24h ?? 0),
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
        const rows: ReadonlyArray<unknown> = await this.entityManager
            .createQueryBuilder(ChannelConnectionsSepayEventEntity, "e")
            .select("e.id", "id")
            .addSelect(`to_char(e.received_at AT TIME ZONE 'UTC', ${UTC_MS})`, "at")
            .addSelect("e.outcome", "outcome")
            .addSelect("e.kind", "kind")
            .addSelect("e.amount_vnd", "amountVnd")
            .addSelect("e.provider_event_id", "providerEventId")
            .addSelect("e.environment", "environment")
            .where("e.workspaceId = :workspaceId AND e.connectionId = :connectionId", {
                workspaceId: connection.workspaceId,
                connectionId: connection.id,
            })
            .orderBy("e.receivedAt", "DESC")
            .limit(EVENT_LIMIT)
            .getRawMany()
        return rows.filter(isEventRead).map(eventOf)
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
     * Issues a new SePay API key (owner): the old one stops verifying calls at once, so the owner pastes the new one into the SePay
     * webhook settings. The key is sealed for re-display and its hash verifies the calls; the answer carries it for the clipboard.
     */
    async rotateKey(actor: ConnectionActor, connectionId: string): Promise<SepayKeyReveal> {
        await this.connections.authorize(actor, OWNER)
        const connection = await this.sepayOf(actor, connectionId)
        const apiKey = `nivo_${randomSecret()}`
        await this.connections.writeSecret(connection.id, apiKey, sha256(apiKey))
        return { apiKey, webhookUrl: this.connections.webhookUrl("sepay", connection.id) }
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
            await this.entityManager
                .createQueryBuilder(ChannelConnectionsSepayEventEntity, "ccse")
                .insert()
                .values({
                    workspaceId: ofSepayFeed("workspace_id"),
                    connectionId: ofSepayFeed("id"),
                    environment: ofSepayFeed("environment"),
                    outcome: () =>
                        `CASE WHEN CAST(:outcome AS text) = 'accepted' AND CAST(:eventId AS text) IS NOT NULL AND EXISTS (SELECT 1 FROM public.channel_connections_sepay_events e WHERE e.connection_id = :connectionId AND e.outcome = 'accepted' AND e.provider_event_id = CAST(:eventId AS text)) THEN 'duplicate' ELSE CAST(:outcome AS text) END`,
                    kind: () => "CAST(:kind AS text)",
                    amountVnd: () => "CAST(:amount AS bigint)",
                    providerEventId: () => "CAST(:eventId AS text)",
                })
                .setParameters({
                    connectionId: record.connectionId,
                    outcome: record.outcome,
                    kind: record.kind,
                    amount: record.amountVnd,
                    eventId: record.providerEventId,
                })
                .execute()
        } catch (error) {
            this.logger.warn(ChannelConnectionsLogEvent.SepayEventNotRecorded, {
                connectionId: record.connectionId,
                reason: error instanceof Error ? error.name : "unknown",
            })
        }
    }

    /** The delivery counters of the connection, one aggregate row. */
    private statsOf(connection: ConnectionRecord): Promise<ReadonlyArray<unknown>> {
        return this.entityManager
            .createQueryBuilder(ChannelConnectionsSepayEventEntity, "e")
            .select(`to_char(max(e.received_at) AT TIME ZONE 'UTC', ${UTC_MS})`, "lastAt")
            .addSelect(
                `to_char(max(e.received_at) FILTER (WHERE e.kind = 'ping' AND e.outcome <> 'unauthorized') AT TIME ZONE 'UTC', ${UTC_MS})`,
                "pingAt",
            )
            .addSelect(
                `to_char(max(e.received_at) FILTER (WHERE e.kind IN ('credit', 'debit') AND e.outcome <> 'unauthorized') AT TIME ZONE 'UTC', ${UTC_MS})`,
                "transactionAt",
            )
            .addSelect("count(*) FILTER (WHERE e.received_at > now() - interval '24 hours')", "total24h")
            .addSelect(
                "count(*) FILTER (WHERE e.received_at > now() - interval '24 hours' AND e.outcome <> 'unauthorized')",
                "valid24h",
            )
            .addSelect(
                "count(*) FILTER (WHERE e.received_at > now() - interval '24 hours' AND e.outcome = 'duplicate')",
                "duplicate24h",
            )
            .where("e.workspaceId = :workspaceId AND e.connectionId = :connectionId", {
                workspaceId: connection.workspaceId,
                connectionId: connection.id,
            })
            .limit(1)
            .getRawMany()
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
            this.statsOf(connection),
            this.connections.agentIds(connection.workspaceId, connection.id),
        ])
        const row = stats.find(isStatsRead)
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
            pingSeenAt: row?.pingAt ?? null,
            transactionSeenAt: row?.transactionAt ?? null,
            health: healthOf(row),
            agentIds,
        }
    }
}
