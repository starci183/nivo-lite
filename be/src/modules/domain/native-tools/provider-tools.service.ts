import { Injectable } from "@nestjs/common"
import { ConnectionBindingsReadService, type ConnectionStatusFacts } from "@modules/domain/connections"
import { nativeRefusal } from "./native-refusal.policy"

/** The most connections of one provider a status read lists. */
const CONNECTIONS_MAX = 20

@Injectable()
/**
 * The reads the provider tools share: the connections of a workspace under one provider (the connection status, the Drive's status).
 */
export class ProviderToolsService {
    constructor(private readonly bindings: ConnectionBindingsReadService) {}

    /** The connections of the workspace under the provider, oldest first, at most twenty; none is an empty list. */
    accountsOf(workspaceId: string, provider: string): Promise<ReadonlyArray<ConnectionStatusFacts>> {
        return this.bindings.ofProvider(workspaceId, provider, CONNECTIONS_MAX)
    }

    /** The connections of the workspace under the provider, oldest first; none is `not_connected`. */
    async connectionsOf(workspaceId: string, provider: string): Promise<ReadonlyArray<ConnectionStatusFacts>> {
        const connections = await this.accountsOf(workspaceId, provider)
        if (connections.length === 0) throw nativeRefusal("not_connected")
        return connections
    }
}
