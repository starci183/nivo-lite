import { Injectable } from "@nestjs/common"
import type { ConnectionStatusFacts } from "@modules/domain/connections"
import { SEPAY_MANIFEST, SepayNativeService } from "@modules/domain/mcp-gateway"
import type { GatewayJson, NativeAdapter, NativeCaller, NativeConnectorManifest } from "@modules/domain/mcp-gateway"
import { needsAttention } from "./native-masking.policy"
import { NativeViewService } from "./native-view.service"
import { providerTools } from "./provider-tools.policy"
import type { ProviderRoute } from "./provider-tools.service"
import { ProviderToolsService } from "./provider-tools.service"

/** The SePay connector with its status tool: the two bank tools unchanged, and `status` beside them. */
export const SEPAY_STATUS_MANIFEST: NativeConnectorManifest = {
    ...SEPAY_MANIFEST,
    tools: [...SEPAY_MANIFEST.tools, ...providerTools("SePay", false)],
}

/** A bank connection as `status` answers it: the account as SePay reported it masked, never a number in clear. */
const lineOf = (connection: ConnectionStatusFacts): GatewayJson => ({
    id: connection.id,
    name: connection.name,
    accountMasked: connection.accountMasked ?? "",
    status: connection.status,
    needsAttention: needsAttention(connection.status, connection.lastError),
})

const ROUTE: ProviderRoute = { provider: "sepay", channel: null, line: lineOf }

@Injectable()
/**
 * The SePay connector of the apps that serve a workspace, for internal callers only: `transactions.list` and `transactions.debits` run as before, through the
 * ledger, and `status` reads the bank connections. It takes the place of the gateway's own SePay adapter, which has no status.
 */
export class SepayStatusNativeService implements NativeAdapter {
    readonly manifest = SEPAY_STATUS_MANIFEST

    constructor(
        private readonly views: NativeViewService,
        private readonly sepay: SepayNativeService,
        private readonly tools: ProviderToolsService,
    ) {}

    /** Runs one SePay tool: the bank tools through the ledger, `status` through the connections. */
    async invoke(workspaceId: string, tool: string, args: GatewayJson, caller: NativeCaller): Promise<GatewayJson> {
        await this.views.internalOf(workspaceId, caller)
        if (tool === "status") return this.tools.answer(workspaceId, ROUTE, tool, args, caller)
        return this.sepay.invoke(workspaceId, tool, args)
    }
}
