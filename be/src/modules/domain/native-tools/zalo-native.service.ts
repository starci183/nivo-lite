import { Injectable } from "@nestjs/common"
import type { ConnectionStatusFacts } from "@modules/domain/connections"
import type { GatewayJson, NativeAdapter, NativeCaller, NativeConnectorManifest } from "@modules/domain/mcp-gateway"
import { needsAttention } from "./native-masking.policy"
import { providerTools } from "./provider-tools.policy"
import type { ProviderRoute } from "./provider-tools.service"
import { ProviderToolsService } from "./provider-tools.service"

/** The Zalo OA native connector: the official accounts of the workspace and their latest messages, for internal use. */
export const ZALO_MANIFEST: NativeConnectorManifest = {
    key: "zalo",
    name: "Zalo OA",
    kind: "native",
    contractVersion: "zalo-native@1",
    tools: providerTools("Zalo OA", true),
}

/** An official account as `status` answers it: its id, never its tokens. */
const lineOf = (connection: ConnectionStatusFacts): GatewayJson => ({
    id: connection.id,
    name: connection.name,
    oaId: connection.oaId ?? "",
    status: connection.status,
    needsAttention: needsAttention(connection.status, connection.lastError),
})

const ROUTE: ProviderRoute = { provider: "zalo_oa", channel: "zalo", line: lineOf }

@Injectable()
/** Runs the Zalo OA tools: `status` and `events`, read through the connections and the message feed of the workspace. */
export class ZaloNativeService implements NativeAdapter {
    readonly manifest = ZALO_MANIFEST

    constructor(private readonly tools: ProviderToolsService) {}

    /** Runs one Zalo OA tool. */
    invoke(workspaceId: string, tool: string, args: GatewayJson, caller: NativeCaller): Promise<GatewayJson> {
        return this.tools.answer(workspaceId, ROUTE, tool, args, caller)
    }
}
