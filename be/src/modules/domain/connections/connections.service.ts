import { Injectable } from "@nestjs/common"
import { Not, Raw } from "typeorm"
import type { EntityManager } from "typeorm"
import { ConnectionSecretsService } from "@modules/domain/connection-secrets"
import { ConnectorInterestService } from "@modules/domain/connector-interest"
import type { OptionalStoredSecret } from "@modules/domain/connection-secrets"
import { WorkspaceMemberEntity } from "@modules/domain/workspace-members"
import { AgentConnectionEntity } from "@modules/domain/agent-connections"
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
import { ConnectionsUpkeepService } from "./connections-upkeep.service"
import { toConnectionRecord } from "./connections.mapper"
import { InjectConnectionsOptions } from "./connections.decorators"
import { ConnectionsLogEvent } from "./connections.log-events"
import type { ConnectionsOptions } from "./connections.options"
import { ConnectionsError, ConnectionsErrorCode } from "./errors/connections.error"
import { ConnectionEntity } from "./persistence/entities"
import { returnedIds, returnedRows, selectConnections } from "./persistence/connection-projection"
import type { ConnectionProjection } from "./persistence/connection-projection"

/** The most rows any list of connections returns. */
const LIST_MAX = 500

/** A pending or failing connection that received something works now. */
const RECOVERED_STATUS = "CASE WHEN status IN ('pending', 'error') THEN 'connected' ELSE status END"

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
        private readonly upkeep: ConnectionsUpkeepService,
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
        const row = await this.entityManager
            .createQueryBuilder(WorkspaceMemberEntity, "m")
            .select("m.role", "role")
            .addSelect("m.display_name", "displayName")
            .where("m.workspace_id = :workspaceId AND m.user_id = :userId AND m.status = 'active'", {
                workspaceId: actor.workspaceId,
                userId: actor.principalId,
            })
            .limit(1)
            .getRawOne<ConnectionMember>()
        const acceptedRoles: ReadonlyArray<string> = roles
        if (row === undefined || !acceptedRoles.includes(row.role)) {
            throw new ConnectionsError({ code: ConnectionsErrorCode.Forbidden })
        }
        return { role: row.role, displayName: row.displayName }
    }

    /** One connection of the workspace, or null. */
    async find(
        workspaceId: string,
        id: string,
        manager: EntityManager = this.entityManager,
    ): Promise<OptionalConnectionRecord> {
        const row = await selectConnections(manager)
            .where("c.workspaceId = :workspaceId AND c.id = :id", { workspaceId, id })
            .limit(1)
            .getRawOne<ConnectionProjection>()
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
        const rows = await selectConnections(manager)
            .where("c.workspaceId = :workspaceId AND c.id = ANY(:ids)", { workspaceId, ids: [...ids] })
            .orderBy("c.createdAt")
            .limit(LIST_MAX)
            .getRawMany<ConnectionProjection>()
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
        const row = await manager.findOne(ConnectionEntity, {
            where: {
                provider,
                status: Not("disconnected"),
                publicMeta: Raw((column) => `${column} ->> :key = :value`, { key, value }),
            },
            select: { id: true, workspaceId: true },
            order: { createdAt: "ASC" },
        })
        return row === null ? null : { id: row.id, workspaceId: row.workspaceId }
    }

    /** The ids of the agents that use a connection, in the order they were attached. */
    async agentIds(workspaceId: string, connectionId: string): Promise<ReadonlyArray<string>> {
        const rows = await this.entityManager
            .createQueryBuilder(AgentConnectionEntity, "a")
            .select("a.agent_id", "agentId")
            .where("a.workspace_id = :workspaceId AND a.connection_id = :connectionId", { workspaceId, connectionId })
            .orderBy("a.created_at")
            .limit(LIST_MAX)
            .getRawMany<{ agentId: string }>()
        return rows.map((row) => row.agentId)
    }

    /** Every connection of the workspace, oldest first. */
    async list(workspaceId: string): Promise<ReadonlyArray<ConnectionRecord>> {
        const rows = await selectConnections(this.entityManager)
            .where("c.workspaceId = :workspaceId AND c.provider <> 'google_drive'", { workspaceId })
            .orderBy("c.createdAt")
            .limit(LIST_MAX)
            .getRawMany<ConnectionProjection>()
        return rows.map(toConnectionRecord)
    }

    /** The providers the workspace is connected to (one entry each, a disconnected connection does not count), at most `limit`. */
    async connectedProviders(workspaceId: string, limit: number): Promise<ReadonlyArray<string>> {
        const rows = await this.entityManager
            .createQueryBuilder(ConnectionEntity, "c")
            .select("c.provider", "provider")
            .distinct(true)
            .where("c.workspaceId = :workspaceId AND c.status <> 'disconnected'", { workspaceId })
            .limit(limit)
            .getRawMany<{ provider: string }>()
        return rows.map((row) => row.provider)
    }

    /** The connections of one provider, oldest first. */
    async listByProvider(
        workspaceId: string,
        provider: Provider,
        options: ListByProviderOptions,
    ): Promise<ReadonlyArray<ConnectionRecord>> {
        const rows = await selectConnections(this.entityManager)
            .where("c.workspaceId = :workspaceId AND c.provider = :provider", { workspaceId, provider })
            .andWhere(options.includeDisconnected ? "true" : "c.status <> 'disconnected'")
            .orderBy("c.createdAt")
            .limit(LIST_MAX)
            .getRawMany<ConnectionProjection>()
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
            const inserted = await tx
                .createQueryBuilder(ConnectionEntity, "co")
                .insert()
                .values({
                    workspaceId: input.workspaceId,
                    provider: input.provider,
                    name,
                    status: input.status,
                    environment: input.environment,
                    createdBy: input.createdBy,
                    publicMeta: () => ":meta::jsonb",
                })
                .setParameter("meta", JSON.stringify(input.meta))
                .returning("id")
                .execute()
            const [id] = returnedIds(inserted.raw)
            if (id === undefined) throw new ConnectionsError({ code: ConnectionsErrorCode.NotFound })
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
        const updated = await this.entityManager
            .createQueryBuilder(ConnectionEntity, "co")
            .update()
            .set({
                ...(name === null ? {} : { name }),
                ...(patch.status === undefined ? {} : { status: patch.status }),
                ...(patch.environment === undefined ? {} : { environment: patch.environment }),
                ...(patch.meta === undefined ? {} : { publicMeta: () => ":meta::jsonb" }),
                ...(patch.lastError === undefined ? {} : { lastError: patch.lastError }),
                updatedAt: () => "now()",
            })
            .where({ workspaceId, id })
            .setParameter("meta", patch.meta === undefined ? null : JSON.stringify(patch.meta))
            .returning("id")
            .execute()
        if (returnedIds(updated.raw).length === 0) {
            throw new ConnectionsError({ code: ConnectionsErrorCode.NotFound, params: { id } })
        }
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
        const deleted = await this.entityManager
            .createQueryBuilder(ConnectionEntity, "co")
            .delete()
            .where({ workspaceId, id })
            .returning("id")
            .execute()
        if (returnedIds(deleted.raw).length === 0) {
            throw new ConnectionsError({ code: ConnectionsErrorCode.NotFound, params: { id } })
        }
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
        const recorded = await manager
            .createQueryBuilder(ConnectionEntity, "co")
            .update()
            .set({
                lastEventAt: () => ":at::timestamptz",
                lastError: null,
                updatedAt: () => ":at::timestamptz",
                status: () => RECOVERED_STATUS,
                firstEvent: () => "COALESCE(first_event, :first::jsonb)",
            })
            .where({ id: connectionId })
            .setParameters({ at: event.at, first: JSON.stringify(first) })
            .returning("name, environment")
            .execute()
        const [row] = returnedRows(recorded.raw)
        if (row === undefined) return null
        const name: unknown = Reflect.get(row, "name")
        return {
            name: typeof name === "string" ? name : "",
            environment: Reflect.get(row, "environment") === "test" ? "test" : "live",
        }
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
        const row = await manager.findOne(ConnectionEntity, {
            where: { id: connectionId, provider, status: Not("disconnected") },
            select: { id: true, workspaceId: true, status: true },
        })
        if (row === null) return refused(ConnectionsErrorCode.NotFound)
        return ok({ id: row.id, workspaceId: row.workspaceId, status: row.status })
    }

    /** Marks the connection as failing with the reason the owner reads on Connections. */
    async markFailing(connectionId: string, reason: string): Promise<void> {
        await this.entityManager.update(
            ConnectionEntity,
            { id: connectionId },
            { status: "error", lastError: reason, updatedAt: () => "now()" },
        )
    }

    /**
     * The connection received its first (or any) event: it turns connected and keeps the first event for the wizard.
     */
    async markReceived(connectionId: string, firstEvent: FirstEvent, manager: EntityManager): Promise<void> {
        await manager
            .createQueryBuilder(ConnectionEntity, "co")
            .update()
            .set({
                lastEventAt: () => "now()",
                updatedAt: () => "now()",
                status: () => RECOVERED_STATUS,
                lastError: () => "CASE WHEN status IN ('pending', 'error') THEN NULL ELSE last_error END",
                firstEvent: () => "COALESCE(first_event, :first::jsonb)",
            })
            .where({ id: connectionId })
            .setParameter("first", JSON.stringify(firstEvent))
            .execute()
    }

    /** The owner authorized the Zalo OA: its id joins the public facts and an error status clears. */
    async applyZaloAuthorization(connectionId: string, oaId?: string): Promise<void> {
        await this.entityManager
            .createQueryBuilder(ConnectionEntity, "co")
            .update()
            .set({
                publicMeta: () => "jsonb_concat(public_meta, CAST(:meta AS jsonb))",
                status: () => "CASE WHEN status = 'error' THEN 'connected' ELSE status END",
                lastError: null,
                updatedAt: () => "now()",
            })
            .where({ id: connectionId })
            .setParameter(
                "meta",
                JSON.stringify(oaId === undefined ? { authorized: true } : { authorized: true, oa_id: oaId }),
            )
            .execute()
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
        await this.entityManager
            .createQueryBuilder(ConnectionEntity, "co")
            .update()
            .set({ publicMeta: () => "jsonb_concat(public_meta, CAST(:facts AS jsonb))", updatedAt: () => "now()" })
            .where({ id: connectionId })
            .andWhere("public_meta -> 'wizard' ->> 'ticket' = :ticket", { ticket })
            .setParameter("facts", JSON.stringify(facts))
            .execute()
    }

    /** A page of the connections the health check judges, in id order, after the given id. */
    healthBatch(afterId: string, size: number): Promise<ReadonlyArray<HealthCandidate>> {
        return this.upkeep.healthBatch(afterId, size)
    }

    /** Records the health verdict in the public facts of the connection. */
    markHealth(connectionId: string, mark: HealthMark): Promise<void> {
        return this.upkeep.markHealth(connectionId, mark)
    }

    /** How often a connection of the workspace syncs by itself and when it last did. */
    scheduleOf(workspaceId: string, id: string): Promise<SyncSchedule> {
        return this.upkeep.scheduleOf(workspaceId, id)
    }

    /** Sets how often a connection syncs by itself (null is manual only). */
    setSchedule(workspaceId: string, id: string, everyMinutes: SyncInterval): Promise<void> {
        return this.upkeep.setSchedule(workspaceId, id, everyMinutes)
    }

    /** A sync finished: the connection works and the given public facts join the old ones. */
    markSynced(connectionId: string, facts: SyncFacts): Promise<void> {
        return this.upkeep.markSynced(connectionId, facts)
    }

    /** A sync failed: the owner reads the reason. */
    markSyncFailed(connectionId: string, reason: string): Promise<void> {
        return this.upkeep.markSyncFailed(connectionId, reason)
    }

    /** Claims the connections of these providers whose scheduled sync is due, soonest first. */
    claimDueSyncs(providers: ReadonlyArray<Provider>, size: number): Promise<ReadonlyArray<ConnectionOwner>> {
        return this.upkeep.claimDueSyncs(providers, size)
    }

    /** Makes one SMTP connection the workspace default; every other one becomes a spare. */
    setDefaultSmtp(workspaceId: string, id: string): Promise<void> {
        return this.upkeep.setDefaultSmtp(workspaceId, id)
    }

    /** The id of the workspace default SMTP connection, or null when it has none. */
    defaultSmtpId(workspaceId: string): Promise<OptionalConnectionId> {
        return this.upkeep.defaultSmtpId(workspaceId)
    }
}
