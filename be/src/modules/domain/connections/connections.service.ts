import { Inject, Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { decodeChannelKey, decryptSecret, encryptSecret, randomSecret } from "./connection-cipher.policy"
import { cleanConnectionName } from "./connection-name.policy"
import { isPlannedConnector } from "./connector-catalog.policy"
import type {
    ConnectionActor,
    ConnectionEvent,
    ConnectionMember,
    ConnectionPatch,
    ConnectionRecord,
    ConnectionRole,
    ConnectionSecret,
    CreateConnectionInput,
    FirstEventState,
    ListByProviderOptions,
    Provider,
    RecordedEvent,
} from "./connections.contracts"
import { toConnectionRecord } from "./connections.mapper"
import { MODULE_OPTIONS_TOKEN } from "./connections.module-definition"
import type { ConnectionsOptions } from "./connections.options"
import { ConnectionsError, ConnectionsErrorCode } from "./errors/connections.error"
import type { ConnectionSecretsRow, ConnectionSelectRow, MemberRow } from "./persistence/connections.rows"
import {
    DELETE_CONNECTION,
    DELETE_SECRET,
    FIND_ACTIVE_MEMBER,
    FIND_CONNECTION,
    FIND_CONNECTIONS_BY_IDS,
    FIND_SECRET,
    INSERT_CONNECTION,
    INSERT_CONNECTOR_INTEREST,
    INSERT_SECRET,
    LIST_CONNECTIONS,
    LIST_CONNECTIONS_BY_PROVIDER,
    PATCH_CONNECTION,
    RECORD_EVENT,
    UPSERT_SECRET,
} from "./persistence/connections.sql"

type SecretRow = Pick<ConnectionSecretsRow, "ciphertext" | "webhook_secret">

@Injectable()
/** The connections of a workspace and their sealed secrets, reached only through the primary EntityManager. */
export class ConnectionsService {
    private readonly key: Buffer

    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @Inject(MODULE_OPTIONS_TOKEN) options: ConnectionsOptions,
    ) {
        const key = decodeChannelKey(options.channelTokenKey.reveal())
        if (key === null) throw new ConnectionsError({ code: ConnectionsErrorCode.KeyInvalid })
        this.key = key
    }

    /** Requires an active member of the workspace holding one of the roles; answers who they are. */
    async authorize(actor: ConnectionActor, roles: ReadonlyArray<ConnectionRole>): Promise<ConnectionMember> {
        const [row] = await this.entityManager.query<Array<MemberRow>>(FIND_ACTIVE_MEMBER, [
            actor.workspaceId,
            actor.principalId,
        ])
        if (row === undefined || !roles.some((role) => role === row.role)) {
            throw new ConnectionsError({ code: ConnectionsErrorCode.Forbidden })
        }
        return { role: row.role, displayName: row.display_name }
    }

    /** One connection of the workspace, or null. */
    async find(
        workspaceId: string,
        id: string,
        manager: EntityManager = this.entityManager,
    ): Promise<ConnectionRecord | null> {
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
     * Creates a connection and its sealed secret in one transaction (inside the caller transaction when one is handed in), so
     * a secret that cannot be stored leaves no connection behind. Answers the id.
     */
    async create(input: CreateConnectionInput, manager?: EntityManager): Promise<string> {
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
            await tx.query(INSERT_SECRET, [id, encryptSecret(this.key, input.secret.plain), input.secret.webhookSecret])
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
    async readSecret(connectionId: string): Promise<ConnectionSecret | null> {
        const [row] = await this.entityManager.query<Array<SecretRow>>(FIND_SECRET, [connectionId])
        if (row === undefined) return null
        try {
            return { plain: decryptSecret(this.key, row.ciphertext), webhookSecret: row.webhook_secret }
        } catch {
            return null
        }
    }

    /** Seals and stores the credential; the webhook secret changes only when one is given (a new row gets a random one). */
    async writeSecret(connectionId: string, plain: string, webhookSecret?: string): Promise<void> {
        await this.entityManager.query(UPSERT_SECRET, [
            connectionId,
            encryptSecret(this.key, plain),
            webhookSecret ?? randomSecret(),
            webhookSecret !== undefined,
        ])
    }

    /** Deletes the stored secret of a connection. */
    async wipeSecret(connectionId: string): Promise<void> {
        await this.entityManager.query(DELETE_SECRET, [connectionId])
    }

    /** Deletes a connection of the workspace (its secret and bindings go with it); a missing one is a typed not-found. */
    async remove(workspaceId: string, id: string): Promise<void> {
        const rows = await this.entityManager.query<Array<{ id: string }>>(DELETE_CONNECTION, [workspaceId, id])
        if (rows[0] === undefined) throw new ConnectionsError({ code: ConnectionsErrorCode.NotFound, params: { id } })
    }

    /**
     * Remembers that an authenticated event reached the connection: pending or error becomes connected, the time is kept,
     * and the first event is stored once. Answers the connection name and environment, or null when it does not exist.
     */
    async recordEvent(connectionId: string, event: ConnectionEvent): Promise<RecordedEvent | null> {
        const first = {
            amount: Math.round(event.amount),
            content: event.content,
            at: event.at,
            ...(event.text === undefined ? {} : { text: event.text }),
        }
        const [row] = await this.entityManager.query<Array<{ name: string; environment: string }>>(RECORD_EVENT, [
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
        await this.entityManager.query(INSERT_CONNECTOR_INTEREST, [actor.workspaceId, connectorId, actor.principalId])
    }
}
