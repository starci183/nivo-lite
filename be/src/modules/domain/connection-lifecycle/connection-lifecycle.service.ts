import { Injectable } from "@nestjs/common"
import { ChannelConnectionsService } from "@modules/domain/channel-connections"
import { ConnectionsError, ConnectionsErrorCode, ConnectionsService } from "@modules/domain/connections"
import type { ConnectionActor } from "@modules/domain/connections"
import { MetaConnectionsService } from "@modules/domain/meta-connections"

const OWNER = ["owner"] as const

@Injectable()
/** Stops using a connection and removes it from the list, whatever its provider. */
export class ConnectionLifecycleService {
    constructor(
        private readonly connections: ConnectionsService,
        private readonly channels: ChannelConnectionsService,
        private readonly meta: MetaConnectionsService,
    ) {}

    /**
     * Stops using a connection: its provider is told first (a Telegram webhook is removed, a Facebook Page stops sending events),
     * the stored credential is wiped, and the row (with its history) stays as disconnected.
     */
    async disconnect(actor: ConnectionActor, connectionId: string): Promise<void> {
        await this.connections.authorize(actor, OWNER)
        const connection = await this.connections.get(actor.workspaceId, connectionId)
        await this.channels.release(connection)
        await this.meta.release(connection)
        await this.connections.wipeSecret(connection.id)
        await this.connections.patch(actor.workspaceId, connection.id, { status: "disconnected", lastError: null })
    }

    /** Removes a disconnected connection from the list (its conversations stay; bindings go with it). */
    async remove(actor: ConnectionActor, connectionId: string): Promise<void> {
        await this.connections.authorize(actor, OWNER)
        const connection = await this.connections.get(actor.workspaceId, connectionId)
        if (connection.status !== "disconnected") {
            throw new ConnectionsError({ code: ConnectionsErrorCode.StillConnected })
        }
        await this.connections.remove(actor.workspaceId, connection.id)
    }
}
