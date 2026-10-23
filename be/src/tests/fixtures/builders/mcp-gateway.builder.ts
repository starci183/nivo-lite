import { createHash } from "node:crypto"
import { builder } from "@starci/jest-preset"
import type { CallLogLine } from "@modules/domain/mcp-call-log"
import type { McpConnectorRow } from "@modules/domain/mcp-connectors"
import type { McpToolGrantRow } from "@modules/domain/mcp-tool-grants"
import type { GatewayCaller, GatewayJson, RemoteTarget, RoleReadiness } from "@modules/domain/mcp-gateway"
import type { McpEndpoint } from "@modules/integrations/mcp"
import { Secret } from "@modules/platform/config"

/** The caller of the gateway specs: an agent in a conversation, with no work item. */
export const GATEWAY_CALLER: GatewayCaller = {
    workspaceId: "ws-1",
    agentId: "sales",
    conversationId: "conv-1",
    workItemId: null,
}

/** One tool of the remote server's live catalog as a read stored it, with its schema hash. */
export const catalogToolOf = (name: string, description: string, readOnly: boolean, extra: GatewayJson = {}) => ({
    name,
    description,
    inputSchema: { type: "object" },
    annotations: { readOnlyHint: readOnly },
    meta: {},
    hash: `hash-${name}`,
    ...extra,
})

/** The live catalog of the remote connector of the gateway specs. */
export const GATEWAY_CATALOG = [
    catalogToolOf("rooms.searchAvailability", "Room types free for a check-in date, nights and guests.", true),
    catalogToolOf("booking.hold", "Hold a room type for 30 minutes for a guest.", false, {
        inputSchema: { type: "object", properties: { idempotencyKey: { type: "string" } } },
    }),
    catalogToolOf("booking.confirm", "Confirm a held booking.", false),
    catalogToolOf("booking.cancel", "Cancel a booking with a reason.", false),
    catalogToolOf("spa.findSlots", "Free spa slots for a service, date, party size and earliest time.", true),
    catalogToolOf("spa.hold", "Hold a spa slot for a guest and party size.", false),
    catalogToolOf("spa.confirm", "Confirm a held spa booking.", false),
    catalogToolOf("stay.current", "The current or next stay of a guest.", true),
    catalogToolOf("keycode.reveal", "The room key code of a checked-in stay.", false),
    catalogToolOf("guest.findByChannelIdentity", "The guest of a channel identity.", true, {
        meta: { "nivo/role": "identity.find" },
    }),
]

/** When the remote connector of the gateway specs had its bearer set. */
const SET_AT = "2026-10-20T01:00:00.000Z"

/** The bearer the credential capability opens for a remote connector in the gateway specs. */
export const GATEWAY_BEARER = new Secret("bearer-1")

/** The endpoint the credential capability answers for a remote target: no bearer when the server takes none. */
export const endpointFor = (target: RemoteTarget): McpEndpoint => ({
    url: target.url,
    bearer: target.credentialState === "none" ? null : GATEWAY_BEARER,
})

/** What the credential capability answers in the gateway specs: GATEWAY_BEARER for every remote target that takes a bearer. */
export const openedEndpointOf = (_workspaceId: string, target: RemoteTarget): Promise<McpEndpoint> =>
    Promise.resolve(endpointFor(target))

/** A remote connector row whose whole live catalog is approved. */
export const remoteConnectorRowOf = builder<McpConnectorRow>({
    key: "hakuen",
    name: "HAKUEN",
    kind: "remote",
    url: "https://hakuen.test/mcp",
    credential_state: "set",
    credential_set_at: SET_AT,
    status: "active",
    contract_version: "hakuen-mcp@1",
    timeout_ms: 4000,
    tool_catalog: GATEWAY_CATALOG,
    catalog_hash: "catalog-1",
    approved_catalog: GATEWAY_CATALOG.map((tool) => ({ name: tool.name, hash: tool.hash })),
    approved_at: "2026-10-20T01:00:00.000Z",
    checked_at: "2026-10-20T01:00:00.000Z",
})

/** A grant of every tool of the remote connector, auto, with one data constraint. */
export const toolGrantRowOf = builder<McpToolGrantRow>({
    tool: "hakuen.*",
    mode: "auto",
    limit_vnd: null,
    constraints: [{ arg: "discountPct", max: 10 }],
})

/** The refusal a gateway call answers. */
export const refusalOf = (code: string, detail: string) => ({ ok: false, code, detail })

/** The answer of a gateway call that ran. */
export const answerOf = (value: GatewayJson) => ({ ok: true, value })

/** The audit line of a refused, ungranted read of the bank credits by the spec caller. */
export const refusedReadLineOf = builder<CallLogLine>({
    workspaceId: "ws-1",
    connector: "sepay",
    tool: "sepay.transactions.list",
    agentId: "sales",
    conversationId: "conv-1",
    workItemId: null,
    argsMaskedJson: '{"limit":5}',
    argsHash: createHash("sha256").update('{"limit":5}').digest("hex"),
    outcome: "refused",
    errorCode: "not_granted",
    resultSummary: "",
    durationMs: 0,
    approvedBy: null,
})

/** The providers of every capability role, none unless the spec names some. */
export const roleProvidersOf = builder<RoleReadiness["providers"]>({
    "identity.find": [],
    "identity.upsert": [],
    "receivable.find": [],
    "receivable.recordPayment": [],
    "payment.credits.list": [],
    "payment.debits.list": [],
    "invoice.list": [],
})

/** What a gateway spec sets up: the connector and grant rows and the default time limit. */
export interface GatewaySpecSetup {
    readonly rows?: ReadonlyArray<McpConnectorRow>
    readonly grants?: ReadonlyArray<McpToolGrantRow>
    readonly timeoutMs?: number
}
