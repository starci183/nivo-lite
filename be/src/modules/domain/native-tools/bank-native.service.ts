import { Injectable } from "@nestjs/common"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import type { GatewayJson, NativeAdapter, NativeCaller, NativeConnectorManifest } from "@modules/domain/mcp-gateway"
import { BankTransactionsRegistryService } from "@modules/domain/provider-registry"
import type { BankTransactionsPort } from "@modules/domain/provider-registry"
import { BANK_TRANSACTIONS_INPUT_SCHEMA, BANK_TRANSACTIONS_SCHEMA } from "./payment-native.schema"
import type { BankTransactionsArgs } from "./payment-native.schema"
import { argumentsOf, nativeRefusal, unknownTool } from "./native-refusal.policy"
import { NativeViewService } from "./native-view.service"

/** The most bank feeds of one provider a list looks across. */
const FEEDS_MAX = 20

/** The bank capability: named by what it does, never by the provider that answers it. */
export const BANK_MANIFEST: NativeConnectorManifest = {
    key: "bank",
    name: "Bank",
    kind: "native",
    contractVersion: "bank-native@1",
    tools: [
        {
            name: "transactions",
            description:
                "The bank transactions of the workspace bank feed in a time window, money in and money out, newest first, read from the provider.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: BANK_TRANSACTIONS_INPUT_SCHEMA,
            argumentSchema: BANK_TRANSACTIONS_SCHEMA,
            secretFields: ["content"],
            internalOnly: true,
        },
    ],
}

@Injectable()
/**
 * `bank.transactions` for a workspace, for internal callers only: the first live, non-test bank feed whose provider registered a
 * transaction list answers. A workspace with none, or whose feed cannot be read yet, is not connected.
 */
export class BankNativeService implements NativeAdapter {
    readonly manifest: NativeConnectorManifest = BANK_MANIFEST

    constructor(
        private readonly views: NativeViewService,
        private readonly bindings: ConnectionBindingsReadService,
        private readonly providers: BankTransactionsRegistryService,
    ) {}

    /** Runs `transactions`; any other tool is unknown. */
    async invoke(workspaceId: string, tool: string, args: GatewayJson, caller: NativeCaller): Promise<GatewayJson> {
        await this.views.internalOf(workspaceId, caller)
        if (tool !== "transactions") throw unknownTool(tool)
        const input = argumentsOf(tool, BANK_TRANSACTIONS_SCHEMA, args)
        const answer = await this.firstAnswer(workspaceId, this.providers.all(), input)
        if (answer === undefined) throw nativeRefusal("not_connected")
        return answer
    }

    /** The answer of the first provider that has a readable live feed in the workspace. */
    private async firstAnswer(
        workspaceId: string,
        ports: ReadonlyArray<BankTransactionsPort>,
        input: BankTransactionsArgs,
    ): Promise<GatewayJson | undefined> {
        const [port, ...rest] = ports
        if (port === undefined) return undefined
        const connection = await this.liveFeed(workspaceId, port.provider)
        const transactions =
            connection === undefined
                ? undefined
                : await port.transactions(connection, {
                      since: input.since === undefined ? undefined : new Date(input.since),
                      until: input.until === undefined ? undefined : new Date(input.until),
                      limit: input.limit,
                  })
        return transactions === undefined
            ? this.firstAnswer(workspaceId, rest, input)
            : { provider: port.provider, transactions: [...transactions] }
    }

    private async liveFeed(workspaceId: string, provider: string): Promise<ConnectionRecord | undefined> {
        const feeds = await this.bindings.ofProvider(workspaceId, provider, FEEDS_MAX)
        const live = feeds.find((feed) => feed.status !== "disconnected")
        const record = live === undefined ? undefined : await this.bindings.recordOf(workspaceId, live.id)
        return record?.environment === "live" ? record : undefined
    }
}
