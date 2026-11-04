import { Injectable, Optional } from "@nestjs/common"
import { GraphNodeEffectsService } from "@modules/domain/graph-nodes"
import type { GatewayJson, NativeAdapter, NativeCaller, NativeConnectorManifest } from "@modules/domain/mcp-gateway"
import { LedgerRegistry, ProviderRegistryError, ProviderRegistryErrorCode } from "@modules/domain/provider-registry"
import type { LedgerPort } from "@modules/domain/provider-registry"
import {
    LEDGER_APPEND_INPUT_SCHEMA,
    LEDGER_APPEND_SCHEMA,
    LEDGER_STATUS_INPUT_SCHEMA,
    LEDGER_STATUS_SCHEMA,
    LEDGER_VOID_INPUT_SCHEMA,
    LEDGER_VOID_SCHEMA,
} from "./ledger-native.schema"
import { argumentsOf, nativeRefusal, unknownTool } from "./native-refusal.policy"
import { NativeViewService } from "./native-view.service"

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
                "Adds one entry (date, order, customer, amount, transaction, status) to the business ledger the workspace connected. A transaction is recorded once; nothing already written is changed or removed.",
            scope: "write",
            defaultMode: "auto",
            inputSchema: LEDGER_APPEND_INPUT_SCHEMA,
            argumentSchema: LEDGER_APPEND_SCHEMA,
            secretFields: ["customer"],
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
            internalOnly: true,
        },
        {
            name: "status",
            description: "Whether the workspace has a business ledger connected and told where to write.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: LEDGER_STATUS_INPUT_SCHEMA,
            argumentSchema: LEDGER_STATUS_SCHEMA,
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
 * is thrown as it is and the run tries again.
 */
export class LedgerNativeService implements NativeAdapter {
    readonly manifest: NativeConnectorManifest = LEDGER_MANIFEST

    constructor(
        private readonly views: NativeViewService,
        private readonly providers: LedgerRegistry,
        @Optional() private readonly once?: GraphNodeEffectsService,
    ) {}

    /** Runs one ledger tool. */
    async invoke(workspaceId: string, tool: string, args: GatewayJson, caller: NativeCaller): Promise<GatewayJson> {
        await this.views.internalOf(workspaceId, caller)
        if (tool === "status") {
            argumentsOf(tool, LEDGER_STATUS_SCHEMA, args)
            return { connected: (await this.readyPort(workspaceId)) !== undefined }
        }
        if (tool === "append") {
            const { entry } = argumentsOf(tool, LEDGER_APPEND_SCHEMA, args)
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

    private async written(
        workspaceId: string,
        key: string,
        write: (port: LedgerPort) => Promise<string | undefined>,
    ): Promise<GatewayJson> {
        const port = await this.readyPort(workspaceId)
        if (port === undefined) throw nativeRefusal("not_connected")
        const act = async (): Promise<{ readonly kind: string; readonly id: string }> => {
            const ref = await this.guarded(() => write(port), port.provider)
            if (ref === undefined) throw nativeRefusal("not_connected")
            return { kind: "ledger-entry", id: ref }
        }
        const call = { key, dedupeKey: key }
        const subject =
            this.once === undefined ? await act() : await this.once.once(workspaceId, "ledger.write", call, act)
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
