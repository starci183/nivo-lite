import { Injectable } from "@nestjs/common"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import type { ConnectionStatusFacts } from "@modules/domain/connections"
import type { GatewayJson, NativeCaller } from "@modules/domain/mcp-gateway"
import { argumentsOf, unknownTool } from "@modules/domain/mcp-gateway"
import { nativeRefusal } from "./native-refusal.policy"
import { NativeViewService } from "./native-view.service"
import { PROVIDER_STATUS_SCHEMA } from "./provider-tools.schema"

/** The most connections of one provider a status read lists. */
const CONNECTIONS_MAX = 20

/** What a provider connector is to the shared tools: its provider and how a connection reads. */
export interface ProviderRoute {
    /** The provider key of the connections. */
    readonly provider: string
    /** How one connection reads in a `status` answer. */
    readonly line: (connection: ConnectionStatusFacts) => GatewayJson
}

@Injectable()
/**
 * The reads the provider tools share: the connections of a workspace under one provider, as each connector words them.
 */
export class ProviderToolsService {
    constructor(
        private readonly views: NativeViewService,
        private readonly bindings: ConnectionBindingsReadService,
    ) {}

    /** Runs the `status.get` tool of a provider connector for an internal caller only; any other tool is unknown. */
    async answer(
        workspaceId: string,
        route: ProviderRoute,
        tool: string,
        args: GatewayJson,
        caller: NativeCaller,
    ): Promise<GatewayJson> {
        await this.views.internalOf(workspaceId, caller)
        if (tool === "status.get") {
            argumentsOf(tool, PROVIDER_STATUS_SCHEMA, args)
            return { connections: (await this.connectionsOf(workspaceId, route.provider)).map(route.line) }
        }
        throw unknownTool(tool)
    }

    /** The connections of the workspace under the provider, oldest first; none is `not_connected`. */
    async connectionsOf(workspaceId: string, provider: string): Promise<ReadonlyArray<ConnectionStatusFacts>> {
        const connections = await this.bindings.ofProvider(workspaceId, provider, CONNECTIONS_MAX)
        if (connections.length === 0) throw nativeRefusal("not_connected")
        return connections
    }
}
