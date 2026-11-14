import { Injectable, Optional } from "@nestjs/common"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { ConnectionBindingsReadService, type ConnectionRecord } from "@modules/domain/connections"
import { InjectGraphEffectOnce, type EffectOnce } from "@modules/domain/graph-nodes"
import {
    type ToolJson,
    type NativeToolFamily,
    type NativeCaller,
    type ToolManifest,
    argumentsOf,
    unknownTool,
} from "@modules/domain/tools"
import {
    LedgerRegistryService,
    ProviderRegistryError,
    ProviderRegistryErrorCode,
    type LedgerPort,
} from "@modules/domain/provider-registry"
import {
    LEDGER_APPEND_INPUT_SCHEMA,
    LEDGER_APPEND_SCHEMA,
    LEDGER_STATUS_INPUT_SCHEMA,
    LEDGER_STATUS_SCHEMA,
    LEDGER_VOID_INPUT_SCHEMA,
    LEDGER_VOID_SCHEMA,
} from "./ledger-native.schema"
import { soleAccountOf } from "./native-account.policy"
import { nativeRefusal } from "./native-refusal.policy"
import { NativeViewService } from "./native-view.service"

/** The ledger capability: named by what it keeps, never by the provider that keeps it. */
export const LEDGER_MANIFEST: ToolManifest = {
    key: "ledger",
    namespace: "nivo.tool.ledger",
    name: "Ledger",
    contractVersion: "ledger-native@1",
    tools: [
        {
            name: "entry.append",
            description:
                "Writes one bank transaction into the business ledger the workspace connected. Give the whole entry in the domain's words (date, order number, customer, amount, transaction id, status, note). A transaction is recorded once; nothing already written is changed or removed.",
            scope: "write",
            defaultMode: "auto",
            inputSchema: LEDGER_APPEND_INPUT_SCHEMA,
            argumentSchema: LEDGER_APPEND_SCHEMA,
            secretFields: ["customer"],
            domain: TOOL.ledgerEntryAppend,
            internalOnly: true,
        },
        {
            name: "entry.void",
            description:
                "Takes the entry of one transaction back by adding a void entry. Nothing already written is changed or removed.",
            scope: "write",
            defaultMode: "auto",
            inputSchema: LEDGER_VOID_INPUT_SCHEMA,
            argumentSchema: LEDGER_VOID_SCHEMA,
            domain: TOOL.ledgerEntryVoid,
            internalOnly: true,
        },
        {
            name: "status.get",
            description: "Whether the workspace has a business ledger connected and told where to write.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: LEDGER_STATUS_INPUT_SCHEMA,
            argumentSchema: LEDGER_STATUS_SCHEMA,
            domain: TOOL.ledgerStatusGet,
            internalOnly: true,
        },
    ],
}

/** The most accounts of one provider the ledger looks through for a ready one. */
const ACCOUNTS_MAX = 20

/** One ledger account that is ready, with the port its provider registered for it (live or sandbox, by the account's flag). */
interface ReadyAccount {
    readonly account: ConnectionRecord
    readonly port: LedgerPort
}

@Injectable()
/**
 * `nivo.tool.ledger.entry.append`, `nivo.tool.ledger.entry.void` and `nivo.tool.ledger.status.get` for a workspace, for internal callers only: a write goes to
 * the provider of the account the tool runner handed, or for the engine's own caller to the ONE provider ready in the workspace (never
 * a silent pick: `writePort`). The ledger is a copy that only grows. A transaction is written once (the key
 * `ledger:<transactionId>` in the ledger of graph-node effects, so a replay, another run or a retry never adds a second entry); a
 * provider refusing the connection is the refusal `connection_refused`, which only the owner can cure; any other failure of the provider
 * is thrown as it is and the run tries again. The once-per-key ledger is what makes a write happen once, so a write is never made
 * without it: an app that binds none (no graph host) answers the refusal `ledger_key_unavailable` and writes nothing, it never appends
 * unkeyed; `nivo.tool.ledger.status.get` needs no key and answers everywhere.
 */
export class LedgerNativeService implements NativeToolFamily {
    readonly manifest: ToolManifest = LEDGER_MANIFEST

    constructor(
        private readonly views: NativeViewService,
        private readonly providers: LedgerRegistryService,
        private readonly bindings: ConnectionBindingsReadService,
        @Optional() @InjectGraphEffectOnce() private readonly once?: EffectOnce,
    ) {}

    /** Runs one ledger tool. */
    async invoke(workspaceId: string, tool: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        await this.views.internalOf(workspaceId, caller)
        if (tool === "status.get") {
            argumentsOf(tool, LEDGER_STATUS_SCHEMA, args)
            return { connected: (await this.readyAccounts(workspaceId, caller)).length > 0 }
        }
        if (tool === "entry.append") {
            const { entry } = argumentsOf(tool, LEDGER_APPEND_SCHEMA, args)
            const key = `ledger:${entry.transactionId}${entry.status === "void" ? ":void" : ""}`
            return this.written(workspaceId, caller, key, (ready) => ready.port.append(ready.account, entry))
        }
        if (tool === "entry.void") {
            const { transactionId } = argumentsOf(tool, LEDGER_VOID_SCHEMA, args)
            return this.written(workspaceId, caller, `ledger:${transactionId}:void`, (ready) =>
                ready.port.void(ready.account, transactionId),
            )
        }
        throw unknownTool(tool)
    }

    private async written(
        workspaceId: string,
        caller: NativeCaller,
        key: string,
        write: (ready: ReadyAccount) => Promise<string | undefined>,
    ): Promise<ToolJson> {
        const { once } = this
        if (once === undefined) throw nativeRefusal("ledger_key_unavailable")
        const target = await this.writeTarget(workspaceId, caller)
        const act = async (): Promise<{ readonly kind: string; readonly id: string }> => {
            const ref = await this.guarded(() => write(target), target.port.provider)
            if (ref === undefined) throw nativeRefusal("not_connected")
            return { kind: "ledger-entry", id: ref }
        }
        const call = { key, dedupeKey: key }
        const subject = await once.once(workspaceId, "ledger.write", call, act)
        return { ref: subject.id }
    }

    private async guarded(work: () => Promise<string | undefined>, provider: string): Promise<string | undefined> {
        try {
            return await work()
        } catch (cause) {
            if (
                cause instanceof ProviderRegistryError &&
                cause.code === ProviderRegistryErrorCode.LedgerConnectionRefused &&
                cause.params.provider === provider
            ) {
                throw nativeRefusal("connection_refused", cause)
            }
            throw cause
        }
    }

    /**
     * The ready ledger accounts of the workspace: for every registered provider (or the one the call names) its FIRST ready account, each
     * through the port `portFor(account)` hands (the live port for a live account, the sandbox port for a sandbox one). A call the tool
     * runner handed an account looks at that account alone.
     */
    private async readyAccounts(workspaceId: string, caller: NativeCaller): Promise<ReadonlyArray<ReadyAccount>> {
        const providers = this.providers
            .providers()
            .filter((provider) => caller.provider === undefined || provider === caller.provider)
        const perProvider = await Promise.all(providers.map((provider) => this.firstReadyOf(workspaceId, provider, caller)))
        return perProvider.flatMap((ready) => ready ?? [])
    }

    /** The first account of one provider that is ready, or undefined. */
    private async firstReadyOf(workspaceId: string, provider: string, caller: NativeCaller): Promise<ReadyAccount | undefined> {
        const accounts = await this.accountsOf(workspaceId, provider, caller)
        const ready = await Promise.all(
            accounts.map(async (account) => {
                const port = this.providers.portFor(account)
                return port !== undefined && (await port.ready(account)) ? { account, port } : undefined
            }),
        )
        return ready.find((one) => one !== undefined)
    }

    /** The open accounts of one provider the call may use, oldest first: the handed account alone when the runner handed one. */
    private async accountsOf(workspaceId: string, provider: string, caller: NativeCaller): Promise<ReadonlyArray<ConnectionRecord>> {
        const ids =
            caller.connectionId === undefined
                ? (await this.bindings.ofProvider(workspaceId, provider, ACCOUNTS_MAX)).map((facts) => facts.id)
                : [caller.connectionId]
        const records = await Promise.all(ids.map((id) => this.bindings.recordOf(workspaceId, id)))
        return records.flatMap((record) =>
            record !== null && record.provider === provider && record.status !== "disconnected" ? [record] : [],
        )
    }

    /**
     * The account a write goes to, never a silent pick (ARCH-REVIEW 2026-11-12 S7): a call the tool runner handed an account, that
     * account when it is ready (`not_connected` otherwise); an agent's call with no account handed is refused `not_connected` (the
     * runner hands the node's books account; none handed means none is bound); the engine's own caller (the declared job) writes to the
     * ONE ready provider's account (`soleAccountOf`: several are `not_selected`, none `not_connected`).
     */
    private async writeTarget(workspaceId: string, caller: NativeCaller): Promise<ReadyAccount> {
        if (caller.connectionId === undefined && caller.engine !== true) throw nativeRefusal("not_connected")
        return soleAccountOf(await this.readyAccounts(workspaceId, caller))
    }
}
