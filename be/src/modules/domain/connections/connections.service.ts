import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ConnectionSecretsService } from "@modules/domain/connection-secrets"
import { ConnectorInterestService } from "@modules/domain/connector-interest"
import type { OptionalStoredSecret } from "@modules/domain/connection-secrets"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { cleanConnectionName } from "./connection-name.policy"
import { isPlannedConnector } from "./connector-catalog.policy"
import { publicSiteUrl, webhookUrlFor } from "./connection-url.policy"
import type {
    ConnectionActor,
    ConnectionOwner,
    ConnectionEvent,
    ConnectionMember,
    ConnectionPatch,
    ConnectionRecord,
    ConnectionRole,
    CreateConnectionInput,
    FirstEvent,
    FirstEventState,
    HealthCandidate,
    HealthMark,
    IntakeConnection,
    ListByProviderOptions,
    OptionalConnectionId,
    OptionalConnectionOwner,
    OptionalConnectionRecord,
    OptionalPublicOrigin,
    OptionalRecordedEvent,
    Provider,
    SyncFacts,
    SyncInterval,
    SyncSchedule,
    WizardSettlement,
} from "./connections.contracts"
import { toConnectionRecord } from "./connections.mapper"
import { InjectConnectionsOptions } from "./connections.decorators"
import { ConnectionsLogEvent } from "./connections.log-events"
import type { ConnectionsOptions } from "./connections.options"
import { ConnectionsError, ConnectionsErrorCode } from "./errors/connections.error"
import type {
    ConnectionSelectRow,
    HealthCandidateRow,
    IntakeConnectionRow,
    MemberRow,
    SyncScheduleRow,
} from "./persistence/connections.rows"
import {
    APPLY_ZALO_AUTHORIZATION,
    DELETE_CONNECTION,
    FIND_ACTIVE_MEMBER,
    FIND_CONNECTION,
    FIND_CONNECTION_AGENT_IDS,
    FIND_DEFAULT_SMTP,
    FIND_SYNC_SCHEDULE,
    FIND_CONNECTIONS_BY_IDS,
    FIND_INTAKE_CONNECTION,
    FIND_LIVE_BY_META,
    INSERT_CONNECTION,
    LIST_CONNECTIONS,
    LIST_CONNECTIONS_BY_PROVIDER,
    CLAIM_DUE_SYNCS,
    LIST_HEALTH_BATCH,
    MARK_CONNECTION_ERROR,
    MARK_CONNECTION_HEALTH,
    MARK_CONNECTION_RECEIVED,
    MARK_SYNC_FAILED,
    MARK_SYNCED,
    PATCH_CONNECTION,
    RECORD_EVENT,
    SET_DEFAULT_SMTP,
    SET_SYNC_SCHEDULE,
    SETTLE_WIZARD,
} from "./persistence/connections.sql"

/** The id every real id sorts after. */
const NIL_UUID = "00000000-0000-0000-0000-000000000000"

@Injectable()
/** The connections of a workspace and their sealed secrets, reached only through the primary EntityManager. */
export class ConnectionsService {
    private readonly siteUrl: string
    private readonly providerUrl: string | undefined

    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectConnectionsOptions() options: ConnectionsOptions,
        @InjectLogger() private readonly logger: Logger,
        private readonly secrets: ConnectionSecretsService,
        private readonly interest: ConnectorInterestService,
    ) {
        this.siteUrl = options.publicSiteUrl ?? options.siteUrl
        this.providerUrl = options.publicApiUrl ?? options.publicSiteUrl
    }

    /**
     * The webhook address a provider must call for a connection (built from the site url even on localhost, for
     * display).
     */
    webhookUrl(provider: Provider, connectionId: string, origin: string = this.providerUrl ?? this.siteUrl): string {
        return webhookUrlFor(provider, connectionId, origin)
    }

    /** The configured site origin browsers are sent back to, with no trailing slash. */
    siteBase(): string {
        let end = this.siteUrl.length
        while (end > 0 && this.siteUrl[end - 1] === "/") end -= 1
        return this.siteUrl.slice(0, end)
    }

    /** The public https origin providers can reach, or null on localhost, plain http or when unset. */
    publicOrigin(): OptionalPublicOrigin {
        return publicSiteUrl(this.providerUrl)
    }

    /** Requires an active member of the workspace holding one of the roles; answers who they are. */
    async authorize(actor: ConnectionActor, roles: ReadonlyArray<ConnectionRole>): Promise<ConnectionMember> {
        const [row] = await this.entityManager.query<Array<MemberRow>>(FIND_ACTIVE_MEMBER, [
            actor.workspaceId,
            actor.principalId,
        ])
        const acceptedRoles: ReadonlyArray<string> = roles
        if (row === undefined || !acceptedRoles.includes(row.role)) {
            throw new ConnectionsError({ code: ConnectionsErrorCode.Forbidden })
        }
        return { role: row.role, displayName: row.display_name }
    }

    /** One connection of the workspace, or null. */
    async find(
        workspaceId: string,
        id: string,
        manager: EntityManager = this.entityManager,
    ): Promise<OptionalConnectionRecord> {
        const [row] = await manager.query<Array<ConnectionSelectRow>>(FIND_CONNECTION, [workspaceId, id])
        return row === undefined ? null : toConnectionRecord(row)
    }

    /** One connection of the workspace; a missing one is a typed not-found. */
    async get(workspaceId: string, id: string, manager?: EntityManager): Promise<ConnectionRecord> {
        const found = await this.find(workspaceId, id, manager)
        if (found === null) throw new ConnectionsError({ code: ConnectionsErrorCode.NotFound, params: { id } })
        return found
    }

    /** Several connections of the workspace by id (ids that do not exist are simply absent). */
    async findMany(
        workspaceId: string,
        ids: ReadonlyArray<string>,
        manager: EntityManager = this.entityManager,
    ): Promise<ReadonlyArray<ConnectionRecord>> {
        const rows = await manager.query<Array<ConnectionSelectRow>>(FIND_CONNECTIONS_BY_IDS, [workspaceId, ids])
        return rows.map(toConnectionRecord)
    }

    /**
     * The oldest live connection of a provider whose public fact `key` equals `value`, in any workspace (a bot or a
     * Page is live in one place only).
     */
    async findLiveByMeta(
        provider: Provider,
        key: string,
        value: string,
        manager: EntityManager = this.entityManager,
    ): Promise<OptionalConnectionOwner> {
        const [row] = await manager.query<Array<{ id: string; workspace_id: string }>>(FIND_LIVE_BY_META, [
            provider,
            key,
            value,
        ])
        return row === undefined ? null : { id: row.id, workspaceId: row.workspace_id }
    }

    /** The ids of the agents that use a connection, in the order they were attached. */
    async agentIds(workspaceId: string, connectionId: string): Promise<ReadonlyArray<string>> {
        const rows = await this.entityManager.query<Array<{ agent_id: string }>>(FIND_CONNECTION_AGENT_IDS, [
            workspaceId,
            connectionId,
        ])
        return rows.map((row) => row.agent_id)
    }

    /** Every connection of the workspace, oldest first. */
    async list(workspaceId: string): Promise<ReadonlyArray<ConnectionRecord>> {
        const rows = await this.entityManager.query<Array<ConnectionSelectRow>>(LIST_CONNECTIONS, [workspaceId])
        return rows.map(toConnectionRecord)
    }

    /** The connections of one provider, oldest first. */
    async listByProvider(
        workspaceId: string,
        provider: Provider,
        options: ListByProviderOptions,
    ): Promise<ReadonlyArray<ConnectionRecord>> {
        const rows = await this.entityManager.query<Array<ConnectionSelectRow>>(LIST_CONNECTIONS_BY_PROVIDER, [
            workspaceId,
            provider,
            options.includeDisconnected,
        ])
        return rows.map(toConnectionRecord)
    }

    /**
     * Creates a connection and its sealed secret in one transaction (inside the caller transaction when one is handed
     * in), so
     * a secret that cannot be stored leaves no connection behind. Answers the id.
     */
    create(input: CreateConnectionInput, manager?: EntityManager): Promise<string> {
        const name = cleanConnectionName(input.name)
        if (name === null) throw new ConnectionsError({ code: ConnectionsErrorCode.NameInvalid })
        const write = async (tx: EntityManager): Promise<string> => {
            const [row] = await tx.query<Array<{ id: string }>>(INSERT_CONNECTION, [
                input.workspaceId,
                input.provider,
                name,
                input.status,
                input.environment,
                input.createdBy,
                JSON.stringify(input.meta),
            ])
            if (row === undefined) throw new ConnectionsError({ code: ConnectionsErrorCode.NotFound })
            const id = row.id
            await this.secrets.create(id, input.secret.plain, input.secret.webhookSecret, tx)
            return id
        }
        return manager === undefined ? this.entityManager.transaction(write) : write(manager)
    }

    /** Changes the given fields of a connection; a missing one is a typed not-found. */
    async patch(workspaceId: string, id: string, patch: ConnectionPatch): Promise<void> {
        const name = patch.name === undefined ? null : cleanConnectionName(patch.name)
        if (patch.name !== undefined && name === null) {
            throw new ConnectionsError({ code: ConnectionsErrorCode.NameInvalid })
        }
        const rows = await this.entityManager.query<Array<{ id: string }>>(PATCH_CONNECTION, [
            workspaceId,
            id,
            name,
            patch.status ?? null,
            patch.environment ?? null,
            patch.meta === undefined ? null : JSON.stringify(patch.meta),
            patch.lastError !== undefined,
            patch.lastError ?? null,
        ])
        if (rows[0] === undefined) throw new ConnectionsError({ code: ConnectionsErrorCode.NotFound, params: { id } })
    }

    /** Opens the stored secret of a connection; null when there is none or it cannot be opened with the current key. */
    async readSecret(connectionId: string): Promise<OptionalStoredSecret> {
        try {
            return await this.secrets.read(connectionId)
        } catch (cause) {
            this.logger.error(ConnectionsLogEvent.Undecryptable, cause, { connectionId })
            return null
        }
    }

    /**
     * Seals and stores the credential; the webhook secret changes only when one is given (a new row gets a random
     * one).
     */
    writeSecret(connectionId: string, plain: string, webhookSecret?: string): Promise<void> {
        return this.secrets.write(connectionId, plain, webhookSecret)
    }

    /** Deletes the stored secret of a connection. */
    wipeSecret(connectionId: string): Promise<void> {
        return this.secrets.wipe(connectionId)
    }

    /**
     * Deletes a connection of the workspace (its secret and bindings go with it); a missing one is a typed not-found.
     */
    async remove(workspaceId: string, id: string): Promise<void> {
        const rows = await this.entityManager.query<Array<{ id: string }>>(DELETE_CONNECTION, [workspaceId, id])
        if (rows[0] === undefined) throw new ConnectionsError({ code: ConnectionsErrorCode.NotFound, params: { id } })
    }

    /**
     * Remembers that an authenticated event reached the connection: pending or error becomes connected, the time is
     * kept,
     * and the first event is stored once. Uses the caller transaction when supplied.
     * Answers the connection name and environment, or null when it does not exist.
     */
    async recordEvent(
        connectionId: string,
        event: ConnectionEvent,
        manager: EntityManager = this.entityManager,
    ): Promise<OptionalRecordedEvent> {
        const first = {
            amount: Math.round(event.amount),
            content: event.content,
            at: event.at,
            ...(event.text === undefined ? {} : { text: event.text }),
        }
        const [row] = await manager.query<Array<{ name: string; environment: string }>>(RECORD_EVENT, [
            connectionId,
            event.at,
            JSON.stringify(first),
        ])
        return row === undefined ? null : { name: row.name, environment: row.environment === "test" ? "test" : "live" }
    }

    /** The wizard polling: has the first event arrived for this connection (manager). */
    async firstEvent(actor: ConnectionActor, id: string): Promise<FirstEventState> {
        await this.authorize(actor, ["owner", "manager"])
        const connection = await this.get(actor.workspaceId, id)
        return { status: connection.status, firstEvent: connection.firstEvent }
    }

    /** Records once per workspace that it wants a planned connector (manager). */
    async wantConnector(actor: ConnectionActor, connectorId: string): Promise<void> {
        await this.authorize(actor, ["owner", "manager"])
        if (!isPlannedConnector(connectorId)) {
            throw new ConnectionsError({ code: ConnectionsErrorCode.ConnectorNotFound, params: { id: connectorId } })
        }
        await this.interest.note(actor.workspaceId, connectorId, actor.principalId)
    }

    /** The connection a delivery arrived on, or a refusal when it is missing, disconnected or of another provider. */
    async intakeOf(
        connectionId: string,
        provider: string,
        manager: EntityManager = this.entityManager,
    ): Promise<Outcome<IntakeConnection, ConnectionsErrorCode>> {
        const row = (
            await manager.query<Array<IntakeConnectionRow>>(FIND_INTAKE_CONNECTION, [connectionId, provider])
        )[0]
        if (row === undefined) return refused(ConnectionsErrorCode.NotFound)
        return ok({ id: row.id, workspaceId: row.workspace_id, status: row.status })
    }

    /** Marks the connection as failing with the reason the owner reads on Connections. */
    async markFailing(connectionId: string, reason: string): Promise<void> {
        await this.entityManager.query(MARK_CONNECTION_ERROR, [connectionId, reason])
    }

    /**
     * The connection received its first (or any) event: it turns connected and keeps the first event for the wizard.
     */
    async markReceived(connectionId: string, firstEvent: FirstEvent, manager: EntityManager): Promise<void> {
        await manager.query(MARK_CONNECTION_RECEIVED, [connectionId, JSON.stringify(firstEvent)])
    }

    /** The owner authorized the Zalo OA: its id joins the public facts and an error status clears. */
    async applyZaloAuthorization(connectionId: string, oaId?: string): Promise<void> {
        await this.entityManager.query(APPLY_ZALO_AUTHORIZATION, [
            connectionId,
            JSON.stringify(oaId === undefined ? { authorized: true } : { authorized: true, oa_id: oaId }),
        ])
    }

    /**
     * A page of the connections the health check judges, in id order, after the given id (empty for the first page).
     */
    async healthBatch(afterId: string, size: number): Promise<ReadonlyArray<HealthCandidate>> {
        const rows = await this.entityManager.query<Array<HealthCandidateRow>>(LIST_HEALTH_BATCH, [
            afterId === "" ? NIL_UUID : afterId,
            size,
        ])
        return rows.map((row) => ({
            id: row.id,
            workspaceId: row.workspace_id,
            provider: row.provider,
            name: row.name,
            status: row.status,
            lastError: row.last_error,
            lastEventAt: row.last_event_at,
            createdAt: row.created_at,
            health: row.health,
        }))
    }

    /** Records the health verdict in the public facts of the connection. */
    async markHealth(connectionId: string, mark: HealthMark): Promise<void> {
        await this.entityManager.query(MARK_CONNECTION_HEALTH, [
            connectionId,
            JSON.stringify({ state: mark.state, reason: mark.reason, checked_at: mark.checkedAt }),
        ])
    }

    /**
     * Writes the result of a wizard job next to its ticket; a newer ticket on the row means the owner moved on and
     * nothing is written.
     */
    async settleWizard(connectionId: string, ticket: string, settlement: WizardSettlement): Promise<void> {
        const wizard = {
            ticket,
            command: settlement.command,
            state: settlement.state,
            url: settlement.url,
            code: settlement.code,
        }
        const facts = settlement.oaSecretSaved ? { oa_secret_saved: true, wizard } : { wizard }
        await this.entityManager.query(SETTLE_WIZARD, [connectionId, ticket, JSON.stringify(facts)])
    }

    /**
     * How often a connection of the workspace syncs by itself and when it last did; a missing one is a typed not-
     * found.
     */
    async scheduleOf(workspaceId: string, id: string): Promise<SyncSchedule> {
        const [row] = await this.entityManager.query<Array<SyncScheduleRow>>(FIND_SYNC_SCHEDULE, [workspaceId, id])
        if (row === undefined) throw new ConnectionsError({ code: ConnectionsErrorCode.NotFound, params: { id } })
        return { everyMinutes: row.sync_every_minutes, lastSyncAt: row.last_sync_at }
    }

    /** Sets how often a connection syncs by itself (null is manual only); the first scheduled sync is due at once. */
    async setSchedule(workspaceId: string, id: string, everyMinutes: SyncInterval): Promise<void> {
        const rows = await this.entityManager.query<Array<{ id: string }>>(SET_SYNC_SCHEDULE, [
            workspaceId,
            id,
            everyMinutes,
        ])
        if (rows[0] === undefined) throw new ConnectionsError({ code: ConnectionsErrorCode.NotFound, params: { id } })
    }

    /**
     * A sync finished: the connection works, the next sync is scheduled and the given public facts join the old ones.
     */
    async markSynced(connectionId: string, facts: SyncFacts): Promise<void> {
        await this.entityManager.query(MARK_SYNCED, [connectionId, JSON.stringify(facts)])
    }

    /** A sync failed: the owner reads the reason and the retry waits at least a quarter of an hour. */
    async markSyncFailed(connectionId: string, reason: string): Promise<void> {
        await this.entityManager.query(MARK_SYNC_FAILED, [connectionId, reason])
    }

    /**
     * Claims the connections of these providers whose scheduled sync is due, soonest first; their next sync moves half
     * an hour on until the sync sets the real time.
     */
    async claimDueSyncs(providers: ReadonlyArray<Provider>, size: number): Promise<ReadonlyArray<ConnectionOwner>> {
        const rows = await this.entityManager.query<Array<{ id: string; workspace_id: string }>>(CLAIM_DUE_SYNCS, [
            providers,
            size,
        ])
        return rows.map((row) => ({ id: row.id, workspaceId: row.workspace_id }))
    }

    /** Makes one SMTP connection the workspace default; every other one becomes a spare. */
    async setDefaultSmtp(workspaceId: string, id: string): Promise<void> {
        await this.entityManager.query(SET_DEFAULT_SMTP, [workspaceId, id])
    }

    /** The id of the workspace default SMTP connection, or null when it has none. */
    async defaultSmtpId(workspaceId: string): Promise<OptionalConnectionId> {
        const [row] = await this.entityManager.query<Array<{ id: string }>>(FIND_DEFAULT_SMTP, [workspaceId])
        return row === undefined ? null : row.id
    }
}
