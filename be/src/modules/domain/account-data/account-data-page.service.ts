import { Injectable } from "@nestjs/common"
import { ConnectionsService, type ConnectionActor } from "@modules/domain/connections"
import type { AccountDataStats } from "./account-data.contracts"
import { AccountDataReadService } from "./account-data-read.service"

@Injectable()
/**
 * The account-data read of a connection's console page: the caller is proved an owner or manager of the workspace and the connection
 * one of that workspace (a connection of another workspace is not found) before its rows are counted per type. Provided only where the
 * ConnectionsService is (the api and cli apps).
 */
export class AccountDataPageService {
    constructor(
        private readonly connections: ConnectionsService,
        private readonly reads: AccountDataReadService,
    ) {}

    /** What the connection's page shows of its data (rows and newest time per type), for a manager of the connection's own workspace. */
    async statsFor(actor: ConnectionActor, connectionId: string): Promise<AccountDataStats> {
        await this.connections.authorize(actor, ["owner", "manager"])
        const connection = await this.connections.get(actor.workspaceId, connectionId)
        return this.reads.statsOf(connection.id)
    }
}
