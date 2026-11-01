import { Injectable } from "@nestjs/common"
import type { ConnectionStatusFacts } from "@modules/domain/connections"
import type { GatewayJson, NativeAdapter, NativeCaller, NativeConnectorManifest } from "@modules/domain/mcp-gateway"
import { needsAttention } from "./native-masking.policy"
import { providerTools } from "./provider-tools.policy"
import type { ProviderRoute } from "./provider-tools.service"
import { ProviderToolsService } from "./provider-tools.service"

/** The Telegram native connector: the bots of the workspace and their latest messages, for internal use. */
export const TELEGRAM_MANIFEST: NativeConnectorManifest = {
    key: "telegram",
    name: "Telegram",
    kind: "native",
    contractVersion: "telegram-native@1",
    tools: providerTools("Telegram", true),
}

/** A bot as `status` answers it: its handle, never its token. */
const lineOf = (connection: ConnectionStatusFacts): GatewayJson => ({
    id: connection.id,
    name: connection.name,
    handle: connection.botUsername ?? "",
    status: connection.status,
    needsAttention: needsAttention(connection.status, connection.lastError),
})

const ROUTE: ProviderRoute = { provider: "telegram", channel: "telegram", line: lineOf }

@Injectable()
/** Runs the Telegram tools: `status` and `events`, read through the connections and the message feed of the workspace. */
export class TelegramNativeService implements NativeAdapter {
    readonly manifest = TELEGRAM_MANIFEST

    constructor(private readonly tools: ProviderToolsService) {}

    /** Runs one Telegram tool. */
    invoke(workspaceId: string, tool: string, args: GatewayJson, caller: NativeCaller): Promise<GatewayJson> {
        return this.tools.answer(workspaceId, ROUTE, tool, args, caller)
    }
}
