import { Injectable, Optional } from "@nestjs/common"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import type { GatewayJson, NativeAdapter, NativeCaller, NativeConnectorManifest } from "@modules/domain/mcp-gateway"
import { ProviderAbilitiesService, argumentsOf, unknownTool } from "@modules/domain/mcp-gateway"
import { BankTransactionsRegistryService } from "@modules/domain/provider-registry"
import type { BankTransactionsPort } from "@modules/domain/provider-registry"
import { BANK_TRANSACTIONS_INPUT_SCHEMA, BANK_TRANSACTIONS_SCHEMA } from "./bank-native.schema"
import type { BankTransactionsArgs } from "./bank-native.schema"
import { nativeRefusal } from "./native-refusal.policy"
import { NativeViewService } from "./native-view.service"

/** The full name of the tool this adapter serves, as the rights catalogue names it. */
const BANK_TRANSACTIONS_TOOL = "bank.transactions"

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
 * `bank.transactions` for a workspace, for internal callers only: the live, non-test bank feeds of the first provider that registered
 * a transaction list answer. An agent reads every account it holds the ability to read transactions on (each movement names its
 * account); the engine's own caller reads the first feed, as before. A workspace with none, or whose feed cannot be read yet, is not connected.
 */
export class BankNativeService implements NativeAdapter {
    readonly manifest: NativeConnectorManifest = BANK_MANIFEST

    constructor(
        private readonly views: NativeViewService,
        private readonly bindings: ConnectionBindingsReadService,
        private readonly providers: BankTransactionsRegistryService,
        @Optional() private readonly abilities?: ProviderAbilitiesService,
    ) {}

    /** Runs `transactions`; any other tool is unknown. */
    async invoke(workspaceId: string, tool: string, args: GatewayJson, caller: NativeCaller): Promise<GatewayJson> {
        await this.views.internalOf(workspaceId, caller)
        if (tool !== "transactions") throw unknownTool(tool)
        const input = argumentsOf(tool, BANK_TRANSACTIONS_SCHEMA, args)
        const allowed = await this.allowedOf(workspaceId, caller)
        const answer = await this.firstAnswer(workspaceId, this.providers.all(), input, allowed)
        if (answer === undefined) throw nativeRefusal("not_connected")
        return answer
    }

    /**
     * The answer of the first provider that has a readable live feed in the workspace, over every such feed the caller may read: the
     * movements of each account, each naming its account (`connectionId`, `account`), newest first.
     */
    private async firstAnswer(
        workspaceId: string,
        ports: ReadonlyArray<BankTransactionsPort>,
        input: BankTransactionsArgs,
        allowed: ReadonlyArray<string> | null,
    ): Promise<GatewayJson | undefined> {
        const [port, ...rest] = ports
        if (port === undefined) return undefined
        const feeds = await this.liveFeeds(workspaceId, port.provider, allowed)
        const read = await Promise.all(
            feeds.map(async (connection) => {
                const transactions = await port.transactions(connection, {
                    since: input.since === undefined ? undefined : new Date(input.since),
                    until: input.until === undefined ? undefined : new Date(input.until),
                    limit: input.limit,
                })
                return transactions?.map((movement) => ({
                    ...movement,
                    connectionId: connection.id,
                    account: connection.name,
                }))
            }),
        )
        const readable = read.filter((movements) => movements !== undefined)
        if (readable.length === 0) return this.firstAnswer(workspaceId, rest, input, allowed)
        const transactions = readable
            .flat()
            .toSorted((left, right) => (left.occurredAt < right.occurredAt ? 1 : left.occurredAt > right.occurredAt ? -1 : 0))
            .slice(0, input.limit)
        return { provider: port.provider, transactions }
    }

    /**
     * The live, non-test bank feeds of a provider the caller may read: every one for the engine's own caller (and where no rights are
     * bound), else only the accounts on which the calling agent holds the ability to read transactions. With no rights in play the
     * first feed alone answers, as before.
     */
    private async liveFeeds(
        workspaceId: string,
        provider: string,
        allowed: ReadonlyArray<string> | null,
    ): Promise<ReadonlyArray<ConnectionRecord>> {
        const feeds = await this.bindings.ofProvider(workspaceId, provider, FEEDS_MAX)
        const open = feeds.filter((feed) => feed.status !== "disconnected")
        const wanted = allowed === null ? open.slice(0, 1) : open.filter((feed) => allowed.includes(feed.id))
        const records = await Promise.all(wanted.map((feed) => this.bindings.recordOf(workspaceId, feed.id)))
        return records.flatMap((record) => (record?.environment === "live" ? [record] : []))
    }

    /** The accounts the caller may read, or null when no account right judges it (the engine's own caller, an app with no rights). */
    private async allowedOf(workspaceId: string, caller: NativeCaller): Promise<ReadonlyArray<string> | null> {
        if (this.abilities === undefined || caller.engine === true) return null
        return this.abilities.accountsOfAgent(workspaceId, caller.agentId, BANK_TRANSACTIONS_TOOL)
    }
}
