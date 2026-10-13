import { Injectable } from "@nestjs/common"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionActor, ConnectionMember } from "@modules/domain/connections"
import type { DataConnection, DataConnectionChange, DataConnectionDraft, DataProvider } from "./data-hub.contracts"
import { isDataProvider } from "./data-hub.contracts"
import { toDataConnection } from "./data-hub.mapper"
import { DataHubError, DataHubErrorCode } from "./errors/data-hub.error"

const OWNER = ["owner"] as const
const MIN_EVERY_MINUTES = 5
const MAX_EVERY_MINUTES = 10_080

@Injectable()
/** What every data wizard shares: the owner check, a workspace's own data connection, its sealed credential and its sync schedule. */
export class DataHubService {
    constructor(private readonly connections: ConnectionsService) {}

    /** Requires the owner of the workspace. */
    owner(actor: ConnectionActor): Promise<ConnectionMember> {
        return this.connections.authorize(actor, OWNER)
    }

    /** One live data connection of the workspace (of the given provider when one is named); a missing, disconnected or foreign one is a typed not-found. */
    async own(workspaceId: string, id: string, provider?: DataProvider): Promise<DataConnection> {
        const record = await this.connections.find(workspaceId, id)
        if (
            record === null ||
            record.status === "disconnected" ||
            !isDataProvider(record.provider) ||
            (provider !== undefined && record.provider !== provider)
        ) {
            throw new DataHubError({ code: DataHubErrorCode.NotFound })
        }
        return toDataConnection(record, await this.connections.scheduleOf(workspaceId, id))
    }

    /** Creates a data connection with its sealed credential and schedule; answers its id. */
    async create(actor: ConnectionActor, draft: DataConnectionDraft): Promise<string> {
        this.requireSchedule(draft.everyMinutes)
        const id = await this.connections.create({
            workspaceId: actor.workspaceId,
            createdBy: actor.principalId,
            provider: draft.provider,
            name: draft.name,
            status: draft.status ?? "connected",
            environment: "live",
            meta: draft.meta,
            secret: { plain: draft.credential, webhookSecret: "" },
        })
        if (draft.everyMinutes !== null) await this.connections.setSchedule(actor.workspaceId, id, draft.everyMinutes)
        return id
    }

    /** Renames a data connection, replaces its public facts and schedule, clears its error and marks it connected. */
    async update(workspaceId: string, id: string, change: DataConnectionChange): Promise<void> {
        this.requireSchedule(change.everyMinutes)
        await this.connections.patch(workspaceId, id, {
            name: change.name,
            meta: change.meta,
            status: "connected",
            lastError: null,
        })
        await this.connections.setSchedule(workspaceId, id, change.everyMinutes)
    }

    /** Sets how often a data connection syncs by itself (null is manual only). */
    async setSchedule(workspaceId: string, id: string, everyMinutes: number | null): Promise<void> {
        this.requireSchedule(everyMinutes)
        await this.connections.setSchedule(workspaceId, id, everyMinutes)
    }

    /** The opened credential of a connection the caller has already proved is its own; null when none is stored or it cannot be opened. */
    async credentialOf(id: string): Promise<string | null> {
        const secret = await this.connections.readSecret(id)
        return secret === null ? null : secret.plain
    }

    /** Seals and stores the credential of a connection the caller has already proved is its own. */
    saveCredential(id: string, credential: string): Promise<void> {
        return this.connections.writeSecret(id, credential)
    }

    /** The agents that hold a grant on a connection. */
    agentIds(workspaceId: string, id: string): Promise<ReadonlyArray<string>> {
        return this.connections.agentIds(workspaceId, id)
    }

    /** Deletes a connection of the workspace, its secret and its hub rows with it. */
    remove(workspaceId: string, id: string): Promise<void> {
        return this.connections.remove(workspaceId, id)
    }

    private requireSchedule(everyMinutes: number | null): void {
        if (everyMinutes === null) return
        if (!Number.isInteger(everyMinutes) || everyMinutes < MIN_EVERY_MINUTES || everyMinutes > MAX_EVERY_MINUTES) {
            throw new DataHubError({ code: DataHubErrorCode.ScheduleInvalid })
        }
    }
}
