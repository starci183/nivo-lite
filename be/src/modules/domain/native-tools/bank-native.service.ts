import { Injectable, Optional } from "@nestjs/common"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { ConnectionBindingsReadService, type ConnectionRecord } from "@modules/domain/connections"
import {
    AgentAccountsService,
    argumentsOf,
    reaskSeenOf,
    unknownTool,
    type ToolJson,
    type NativeToolFamily,
    type NativeCaller,
    type ToolManifest,
} from "@modules/domain/tools"
import { BankTransactionsRegistryService, type BankTransactionsPort } from "@modules/domain/provider-registry"
import {
    BANK_TRANSACTIONS_INPUT_SCHEMA,
    BANK_TRANSACTIONS_SCHEMA,
    type BankTransactionsArgs,
} from "./bank-native.schema"
import { nativeRefusal } from "./native-refusal.policy"
import { NativeViewService } from "./native-view.service"

/** The full name of the tool this adapter serves, as the rights catalogue names it. */
const BANK_TRANSACTIONS_TOOL: string = TOOL.bankTransactionList

/** The most bank feeds of one provider a list looks across. */
const FEEDS_MAX = 20

/** A movement as far as its ordering reads it: the instant it occurred at. */
interface DatedMovement {
    /** When the movement occurred, ISO. */
    readonly occurredAt: string
}

/** Orders two movements newest first, by the instant each occurred at. */
const newestFirst = (left: DatedMovement, right: DatedMovement): number => {
    if (left.occurredAt < right.occurredAt) return 1
    return left.occurredAt > right.occurredAt ? -1 : 0
}

/** The bank capability: named by what it does, never by the provider that answers it. */
export const BANK_MANIFEST: ToolManifest = {
    key: "bank",
    namespace: "nivo.tool.bank",
    name: "Bank",
    contractVersion: "bank-native@1",
    tools: [
        {
            name: "transaction.list",
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

/**
 * The accounts a read covers once the tool runner handed it one account: that account alone, when the caller may read it (or no right
 * judges the caller); the accounts as they were when no account was handed.
 */
const narrowedTo = (
    allowed: ReadonlyArray<string> | null,
    connectionId: string | undefined,
): ReadonlyArray<string> | null => {
    if (connectionId === undefined) return allowed
    return allowed === null ? [connectionId] : allowed.filter((id) => id === connectionId)
}

@Injectable()
/**
 * `nivo.tool.bank.transaction.list` for a workspace, for internal callers only: the live, non-test bank feeds of the first provider that registered
 * a transaction list answer. An agent reads every account it holds the ability to read transactions on (each movement names its
 * account); the engine's own caller reads every live feed. A workspace with none, or whose feed cannot be read yet, is not connected.
 */
export class BankNativeService implements NativeToolFamily {
    readonly manifest: ToolManifest = BANK_MANIFEST

    constructor(
        private readonly views: NativeViewService,
        private readonly bindings: ConnectionBindingsReadService,
        private readonly providers: BankTransactionsRegistryService,
        @Optional() private readonly abilities?: AgentAccountsService,
    ) {}

    /** Runs `transaction.list`; any other tool is unknown. */
    async invoke(workspaceId: string, tool: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        await this.views.internalOf(workspaceId, caller)
        if (tool !== "transaction.list") throw unknownTool(tool)
        const input = argumentsOf(tool, BANK_TRANSACTIONS_SCHEMA, args)
        const allowed = narrowedTo(await this.allowedOf(workspaceId, caller), caller.connectionId)
        const ports = this.providers.all().filter((port) => caller.provider === undefined || port.provider === caller.provider)
        const answer = await this.firstAnswer(workspaceId, ports, input, allowed)
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
    ): Promise<ToolJson | undefined> {
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
            .toSorted(newestFirst)
            .slice(0, input.limit)
        return { provider: port.provider, transactions }
    }

    /**
     * The live, non-test bank feeds of a provider the caller may read: every one for the engine's own caller (and where no rights are
     * bound), else only the accounts on which the calling agent holds the ability to read transactions. The read covers every feed it
     * may read (an `each` read, ARCH-REVIEW 2026-11-12 S7): never the first feed alone.
     */
    private async liveFeeds(
        workspaceId: string,
        provider: string,
        allowed: ReadonlyArray<string> | null,
    ): Promise<ReadonlyArray<ConnectionRecord>> {
        const feeds = await this.bindings.ofProvider(workspaceId, provider, FEEDS_MAX)
        const open = feeds.filter((feed) => feed.status !== "disconnected")
        const wanted = allowed === null ? open : open.filter((feed) => allowed.includes(feed.id))
        const records = await Promise.all(wanted.map((feed) => this.bindings.recordOf(workspaceId, feed.id)))
        return records.flatMap((record) => (record?.environment === "live" ? [record] : []))
    }

    /** The accounts the caller may read, or null when no account right judges it (the engine's own caller, an app with no rights). */
    private async allowedOf(workspaceId: string, caller: NativeCaller): Promise<ReadonlyArray<string> | null> {
        if (this.abilities === undefined || caller.engine === true) return null
        const seen = reaskSeenOf(caller)
        if (seen === undefined) return this.abilities.accountsOfAgent(workspaceId, caller.agentId, BANK_TRANSACTIONS_TOOL)
        return this.abilities.accountsOfAgent(workspaceId, caller.agentId, BANK_TRANSACTIONS_TOOL, seen)
    }
}
