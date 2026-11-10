import { Injectable, Optional } from "@nestjs/common"
import { ledgerEntryOf } from "@nivo-lite/blocks-core/modules/accounting"
import { EntityEngineService, EntityPortsService } from "@modules/domain/entity-engine"
import type { RunIn } from "@modules/domain/entity-engine"
import { InjectGraphEffectOnce } from "@modules/domain/graph-nodes"
import type { EffectOnce } from "@modules/domain/graph-nodes"
import type { GatewayJson, NativeAdapter, NativeCaller, NativeConnectorManifest } from "@modules/domain/mcp-gateway"
import { argumentsOf, unknownTool } from "@modules/domain/mcp-gateway"
import {
    LedgerRegistryService,
    ProviderRegistryError,
    ProviderRegistryErrorCode,
} from "@modules/domain/provider-registry"
import type { BusinessLedgerEntry, LedgerPort } from "@modules/domain/provider-registry"
import {
    LEDGER_APPEND_INPUT_SCHEMA,
    LEDGER_APPEND_SCHEMA,
    LEDGER_STATUS_INPUT_SCHEMA,
    LEDGER_STATUS_SCHEMA,
    LEDGER_VOID_INPUT_SCHEMA,
    LEDGER_VOID_SCHEMA,
} from "./ledger-native.schema"
import { nativeRefusal } from "./native-refusal.policy"
import { NativeViewService } from "./native-view.service"

const TRANSACTION = "payment.transaction"
const ORDER = "sales.order"
const LEAD = "sales.lead"

/** The id of a record. */
const RECORD_ID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu

/** The ledger capability: named by what it keeps, never by the provider that keeps it. */
export const LEDGER_MANIFEST: NativeConnectorManifest = {
    key: "ledger",
    name: "Ledger",
    kind: "native",
    contractVersion: "ledger-native@1",
    tools: [
        {
            name: "append",
            description:
                "Writes one bank transaction into the business ledger the workspace connected. Give the transaction id alone: the date, amount, order number and customer of the line are read from the records. A transaction is recorded once; nothing already written is changed or removed.",
            scope: "write",
            defaultMode: "auto",
            inputSchema: LEDGER_APPEND_INPUT_SCHEMA,
            argumentSchema: LEDGER_APPEND_SCHEMA,
            secretFields: ["customer"],
            domain: "ledger.append",
            internalOnly: true,
        },
        {
            name: "void",
            description:
                "Takes the entry of one transaction back by adding a void entry. Nothing already written is changed or removed.",
            scope: "write",
            defaultMode: "auto",
            inputSchema: LEDGER_VOID_INPUT_SCHEMA,
            argumentSchema: LEDGER_VOID_SCHEMA,
            domain: "ledger.void",
            internalOnly: true,
        },
        {
            name: "status",
            description: "Whether the workspace has a business ledger connected and told where to write.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: LEDGER_STATUS_INPUT_SCHEMA,
            argumentSchema: LEDGER_STATUS_SCHEMA,
            domain: "ledger.status",
            internalOnly: true,
        },
    ],
}

@Injectable()
/**
 * `ledger.append`, `ledger.void` and `ledger.status` for a workspace, for internal callers only: the first registered provider that is
 * ready in the workspace keeps the ledger. The ledger is a copy that only grows. A transaction is written once (the key
 * `ledger:<transactionId>` in the ledger of graph-node effects, so a replay, another run or a retry never adds a second entry); a
 * provider refusing the connection is the refusal `connection_refused`, which only the owner can cure; any other failure of the provider
 * is thrown as it is and the run tries again. The once-per-key ledger is what makes a write happen once, so a write is never made
 * without it: an app that binds none (no graph host) answers the refusal `ledger_key_unavailable` and writes nothing, it never appends
 * unkeyed; `ledger.status` needs no key and answers everywhere.
 */
export class LedgerNativeService implements NativeAdapter {
    readonly manifest: NativeConnectorManifest = LEDGER_MANIFEST

    constructor(
        private readonly views: NativeViewService,
        private readonly providers: LedgerRegistryService,
        @Optional() @InjectGraphEffectOnce() private readonly once?: EffectOnce,
        @Optional() private readonly engine?: EntityEngineService,
        @Optional() private readonly ports?: EntityPortsService,
    ) {}

    /** Runs one ledger tool. */
    async invoke(workspaceId: string, tool: string, args: GatewayJson, caller: NativeCaller): Promise<GatewayJson> {
        await this.views.internalOf(workspaceId, caller)
        if (tool === "status") {
            argumentsOf(tool, LEDGER_STATUS_SCHEMA, args)
            return { connected: (await this.readyPort(workspaceId)) !== undefined }
        }
        if (tool === "append") {
            const asked = argumentsOf(tool, LEDGER_APPEND_SCHEMA, args)
            const entry = "entry" in asked ? asked.entry : await this.entryOf(workspaceId, asked.transactionId)
            const key = `ledger:${entry.transactionId}${entry.status === "void" ? ":void" : ""}`
            return this.written(workspaceId, key, (port) => port.append(workspaceId, entry))
        }
        if (tool === "void") {
            const { transactionId } = argumentsOf(tool, LEDGER_VOID_SCHEMA, args)
            return this.written(workspaceId, `ledger:${transactionId}:void`, (port) =>
                port.void(workspaceId, transactionId),
            )
        }
        throw unknownTool(tool)
    }

    /**
     * The entry of a bank transaction named by its id, built from the records (the transaction, the order it paid, the customer): no
     * figure of the line comes from the caller. A transaction that is not there, or paid nothing yet, is the refusal `not_found`.
     */
    private async entryOf(workspaceId: string, transactionId: string): Promise<BusinessLedgerEntry> {
        if (this.engine === undefined || this.ports === undefined || !RECORD_ID.test(transactionId)) {
            throw nativeRefusal("not_found")
        }
        const { engine, ports } = this
        const built = await engine.scoped(workspaceId, (tx) => {
            const runIn: RunIn = (use) => use(tx)
            return ledgerEntryOf(
                {
                    transactions: ports.entityApi(runIn, "action", TRANSACTION),
                    orders: ports.entityApi(runIn, "action", ORDER),
                    leads: ports.entityApi(runIn, "action", LEAD),
                },
                transactionId,
            )
        })
        if ("refused" in built) throw nativeRefusal("not_found")
        return built.entry
    }

    private async written(
        workspaceId: string,
        key: string,
        write: (port: LedgerPort) => Promise<string | undefined>,
    ): Promise<GatewayJson> {
        const { once } = this
        if (once === undefined) throw nativeRefusal("ledger_key_unavailable")
        const port = await this.readyPort(workspaceId)
        if (port === undefined) throw nativeRefusal("not_connected")
        const act = async (): Promise<{ readonly kind: string; readonly id: string }> => {
            const ref = await this.guarded(() => write(port), port.provider)
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

    /** The first registered provider that is ready in the workspace; every provider is asked at once. */
    private async readyPort(workspaceId: string): Promise<LedgerPort | undefined> {
        const ports = this.providers.all()
        const ready = await Promise.all(ports.map((port) => port.ready(workspaceId)))
        return ports.find((_port, index) => ready[index] === true)
    }
}
