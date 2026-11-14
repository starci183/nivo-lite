import { Injectable } from "@nestjs/common"
import type { ConnectionStatusFacts } from "@modules/domain/connections"
import {
    argumentsOf,
    unknownTool,
    type ToolJson,
    type NativeToolFamily,
    type NativeCaller,
    type ToolManifest,
    type ProviderPart,
} from "@modules/domain/tools"
import {
    CONNECTION_STATUS_INPUT_SCHEMA,
    CONNECTION_STATUS_PROVIDERS,
    CONNECTION_STATUS_SCHEMA,
    type ConnectionStatusProvider,
} from "./connection-status-native.schema"
import { needsAttention } from "./native-masking.policy"
import { nativeRefusal } from "./native-refusal.policy"
import { NativeViewService } from "./native-view.service"
import { ProviderToolsService } from "./provider-tools.service"

/** The tool inside the connector: its full name is `nivo.tool.connection.status.get` (`TOOL.connectionStatusGet`). */
export const STATUS_GET = "status.get"

/** One provider the connection status answers: its key and how one of its accounts reads (never a token, a number in clear). */
export interface ConnectionRoute {
    /** The provider key of the accounts. */
    readonly provider: ConnectionStatusProvider
    /** How one account reads in the answer. */
    readonly line: (connection: ConnectionStatusFacts) => ToolJson
}

/** A bank connection: the account as SePay reported it masked. */
const bankLine = (connection: ConnectionStatusFacts): ToolJson => ({
    id: connection.id,
    name: connection.name,
    accountMasked: connection.accountMasked ?? "",
    status: connection.status,
    needsAttention: needsAttention(connection.status, connection.lastError),
})

/** An official account: its id, never its tokens. */
const officialAccountLine = (connection: ConnectionStatusFacts): ToolJson => ({
    id: connection.id,
    name: connection.name,
    oaId: connection.oaId ?? "",
    status: connection.status,
    needsAttention: needsAttention(connection.status, connection.lastError),
})

/** A bot: its handle, never its token. */
const botLine = (connection: ConnectionStatusFacts): ToolJson => ({
    id: connection.id,
    name: connection.name,
    handle: connection.botUsername ?? "",
    status: connection.status,
    needsAttention: needsAttention(connection.status, connection.lastError),
})

/** Every provider the connection status answers, in the order of its parts: each line is the one its own status tool answered. */
export const CONNECTION_ROUTES: Readonly<Record<ConnectionStatusProvider, ConnectionRoute>> = {
    sepay: { provider: "sepay", line: bankLine },
    zalo_oa: { provider: "zalo_oa", line: officialAccountLine },
    telegram: { provider: "telegram", line: botLine },
}

/**
 * The connector of the connection status: ONE tool for every provider, `nivo.tool.connection.status.get`, answered in one part per provider
 * (`providerParts`), for internal use only. The gateway judges each part as its own call on its provider (the SePay part on the
 * attachments' `transactions.read`, the Zalo OA and Telegram parts on the tool grants, each part on its provider's data kind) and hands
 * this adapter the parts the caller may see.
 */
export const CONNECTION_MANIFEST: ToolManifest = {
    key: "connection",
    namespace: "nivo.tool.connection",
    name: "NIVO connections",
    contractVersion: "connection-native@1",
    tools: [
        {
            name: STATUS_GET,
            description:
                "Whether the business's accounts of each provider (the bank feed, Zalo OA, Telegram; or the one provider named) are connected, and whether one needs the owner's attention.",
            scope: "read",
            defaultMode: "auto",
            inputSchema: CONNECTION_STATUS_INPUT_SCHEMA,
            argumentSchema: CONNECTION_STATUS_SCHEMA,
            internalOnly: true,
            providerParts: CONNECTION_STATUS_PROVIDERS,
        },
    ],
}

/** The parts a call answers: those the gateway let through, else (a caller the gateway did not judge per part) every provider's. */
const partsOf = (caller: NativeCaller): ReadonlyArray<ProviderPart> =>
    caller.parts ?? CONNECTION_STATUS_PROVIDERS.map((provider) => ({ provider }))

/** The providers the connection status has a route for, as text. */
const ROUTED_PROVIDERS: ReadonlySet<string> = new Set(CONNECTION_STATUS_PROVIDERS)

/** True for a provider the connection status has a route for. */
const isRouted = (provider: string): provider is ConnectionStatusProvider => ROUTED_PROVIDERS.has(provider)

/** The route of a part, or undefined for a provider the connection status has no route for. */
const routeOf = (provider: string): ConnectionRoute | undefined =>
    isRouted(provider) ? CONNECTION_ROUTES[provider] : undefined

/** One part as answered: the provider and its accounts. */
interface AnsweredPart {
    /** The provider key. */
    readonly provider: string
    /** The accounts, as the provider's line words them. */
    readonly connections: ReadonlyArray<ToolJson>
}

@Injectable()
/**
 * Runs `nivo.tool.connection.status.get`: the accounts of the workspace per provider, at most twenty a provider, oldest first, each worded
 * as the provider's own status tool worded it, for internal callers only. The call names one provider or none (every part the gateway
 * let through). No account in any answered part is the refusal `not_connected`, as the
 * provider's own status tool refused it.
 */
export class ConnectionStatusNativeService implements NativeToolFamily {
    readonly manifest: ToolManifest = CONNECTION_MANIFEST

    constructor(
        private readonly views: NativeViewService,
        private readonly tools: ProviderToolsService,
    ) {}

    /** Runs the connection status. */
    async invoke(workspaceId: string, tool: string, args: ToolJson, caller: NativeCaller): Promise<ToolJson> {
        await this.views.internalOf(workspaceId, caller)
        if (tool !== STATUS_GET) throw unknownTool(tool)
        const { provider } = argumentsOf(tool, CONNECTION_STATUS_SCHEMA, args)
        const parts = partsOf(caller).filter((part) => provider === undefined || part.provider === provider)
        const answered = await Promise.all(
            parts.flatMap((part): ReadonlyArray<Promise<AnsweredPart>> => {
                const route = routeOf(part.provider)
                return route === undefined ? [] : [this.answered(workspaceId, route)]
            }),
        )
        if (answered.every((part) => part.connections.length === 0)) throw nativeRefusal("not_connected")
        return {
            providers: answered.map(({ provider, connections }): ToolJson => ({ provider, connections: [...connections] })),
        }
    }

    private async answered(workspaceId: string, route: ConnectionRoute): Promise<AnsweredPart> {
        const connections = await this.tools.accountsOf(workspaceId, route.provider)
        return { provider: route.provider, connections: connections.map((connection) => route.line(connection)) }
    }
}
