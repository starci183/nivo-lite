import type { ConnectionStatusFacts } from "@modules/domain/connections"
import { ToolsErrorCode } from "@modules/domain/tools"
import { pinOf, type OpenApiToolDeclaration } from "@modules/domain/openapi-tools"
import fixture from "@modules/domain/native-tools/openapi-native.service.fixtures.json"
import { OpenApiConnectorService, type OpenApiConnectorPorts, type OpenApiToolSource } from "@modules/domain/native-tools/openapi-native.service"
import type { Locale } from "@modules/platform/i18n"
import { ok } from "@modules/platform/primitives"

/** The workspace the OpenAPI connector specs run in. */
export const WORKSPACE = "7b0f0a52-1111-4222-8333-444455556666"
/** The connected API account the OpenAPI connector specs call through. */
export const ACCOUNT = "8f8f2c1e-0000-4000-8000-00000000c001"
/** The sealed service key of the account, as a spec reads it. */
export const KEY = "sealed-service-key-value"
/** The agent turn a spec calls a tool as. */
/**
 * The calling agent of a step, with the account the tool runner handed it (as every agent call of a single-account operation arrives:
 * an agent call with none handed is refused, ARCH-REVIEW 2026-11-12 S7).
 */
export const CALLER = { agentId: "agent-1", conversationId: null, opKey: "run-1:step-1", connectionId: ACCOUNT }
/** The answer the scripted outside system gives for a customer. */
export const CUSTOMER = { code: "ACME", name: "Acme Co", reachable: true }
/** The run an audience case speaks for, before it says whom it acts for. */
export interface AudienceRun {
    readonly turnId: string
    readonly locale: Locale
    readonly memberId: string | null
    readonly handedOffBy: string | null
    readonly leadId: string | null
    readonly stepTools: ReadonlyArray<string>
}

/** The run an audience case speaks for. */
export const RUN: AudienceRun = { turnId: "run-1", locale: "vi", memberId: null, handedOffBy: null, leadId: null, stepTools: [] }

/** The provider key of the CRM the specs connect (`crm.<crmId>`): its operations are `nivo.api.crm.nivoweb.<method>.<path>`. */
export const CRM = "crm.nivoweb"

/** The ONE name of an operation of the connected CRM, by its name inside the connector (`get.customers.code`). */
export const opOf = (name: string): string => `nivo.api.${CRM}.${name}`

/** A tool declaration of the plugin on the CRM `crm.nivoweb`, by its name inside the connector. */
export const declared = (name: string, reads: boolean): OpenApiToolDeclaration => ({
    tool: opOf(name),
    connector: CRM,
    name,
    reads,
})

/** A plugin's validator of flat arguments, scripted: the required members, the optional ones, nothing else. */
export const reader = (required: ReadonlyArray<string>, optional: ReadonlyArray<string>): OpenApiToolSource["args"] => ({
    safeParse: (args) => {
        const names = typeof args === "object" && args !== null ? Object.keys(args) : []
        const known = names.every((name) => required.includes(name) || optional.includes(name))
        return { success: known && required.every((name) => names.includes(name)) }
    },
})

/** A scripted tool: its declaration, the members it takes by type, which of them are optional, and its words. */
export const source = (
    declaration: OpenApiToolDeclaration,
    members: Readonly<Record<string, string>>,
    optional: ReadonlyArray<string>,
    description: string,
): OpenApiToolSource => ({
    declaration,
    args: reader(
        Object.keys(members).filter((name) => !optional.includes(name)),
        optional,
    ),
    inputSchema: { type: "object", properties: Object.fromEntries(Object.entries(members).map(([name, type]) => [name, { type }])) },
    description,
})

/** The scripted tools of the connector the specs run. */
export const SOURCES: ReadonlyArray<OpenApiToolSource> = [
    source(declared("get.customers.code", true), { code: "string" }, [], "Reads one customer."),
    source(declared("get.customers", true), { q: "string", limit: "integer", cursor: "string" }, ["limit", "cursor"], "Finds customers."),
    source(
        declared("post.services.code.renewals", false),
        { code: "string", termMonths: "integer", dryRun: "boolean" },
        ["dryRun"],
        "Renews a service.",
    ),
    source(declared("get.tickets", true), { state: "string" }, ["state"], "Lists tickets."),
    source(declared("post.tickets.id.close", false), { id: "string" }, [], "Closes a ticket."),
    source(declared("post.services.code.reminders", true), { code: "string", outcome: "string" }, [], "Wrongly a read."),
]

/** One connection row of the workspace, with the status a case gives it. */
export const connection = (id: string, status = "connected"): ConnectionStatusFacts => ({
    id,
    provider: "openapi",
    name: "CRM",
    status,
    createdAt: new Date("2026-11-01T00:00:00.000Z"),
    botUsername: null,
    accountMasked: null,
    lastError: null,
    oaId: null,
    email: null,
})

/** What a case changes of the account that pinned the fixture document. */
export interface MetaChange {
    readonly baseUrl?: string
    readonly live?: boolean
    readonly connector?: string
    readonly swaggerUrl?: string
    readonly document?: string
}

/** The public facts of an account that pinned the fixture document for a CRM (`crm.nivoweb` unless a case says), with what a case changes. */
export const metaOf = (change: MetaChange = {}): Record<string, string> => {
    const pinning = pinOf(
        {
            documentText: JSON.stringify(fixture),
            connector: change.connector ?? CRM,
            swaggerUrl: change.swaggerUrl ?? "",
            workspaceHeader: "X-Workspace-Id",
            live: change.live ?? false,
            pinnedBy: "member-1",
            pinnedAt: "2026-11-12T00:00:00.000Z",
        },
        [],
    )
    return {
        config: JSON.stringify({ v: 1, baseUrl: change.baseUrl ?? "https://crm.example.test", authType: "header", authName: "X-Crm-Service-Key" }),
        ...(pinning.ok ? pinning.meta : {}),
        ...(change.document === undefined ? {} : { agentDocument: change.document }),
    }
}

/** The outbound HTTP client port of the connector. */
export type Client = NonNullable<OpenApiConnectorPorts["client"]>

/** The clock of the scripted connector: the instant it reads, in epoch milliseconds, which a case may move. */
export interface ConnectorClock {
    ms: number
}

/** The connector beside its scripted ports and the doubles a case reads back. */
export interface OpenApiWorld {
    readonly connector: OpenApiConnectorService
    readonly ports: OpenApiConnectorPorts
    readonly call: jest.Mock<ReturnType<Client["call"]>, Parameters<Client["call"]>>
    readonly fetchSpec: jest.Mock
    readonly accountsOfAgent: jest.Mock
    readonly resolve: jest.Mock
    readonly secretOf: jest.Mock
    readonly ofProvider: jest.Mock
    readonly now: ConnectorClock
}

/** A connector over scripted ports: one attached account, a readable key, a public host, and the HTTP answers a case scripts. */
export const build = (meta: Record<string, string> = metaOf(), development = false): OpenApiWorld => {
    const now: ConnectorClock = { ms: Date.parse("2026-11-12T08:00:00.000Z") }
    const call = jest.fn<ReturnType<Client["call"]>, Parameters<Client["call"]>>()
    call.mockResolvedValue({ status: 200, headers: {}, text: JSON.stringify(CUSTOMER) })
    const fetchSpec = jest.fn().mockResolvedValue(JSON.stringify(fixture))
    const accountsOfAgent = jest.fn().mockResolvedValue([ACCOUNT])
    const resolve = jest.fn().mockResolvedValue({ address: "203.0.113.9", family: 4 })
    const ofProvider = jest.fn().mockResolvedValue([connection(ACCOUNT)])
    const secretOf = jest.fn().mockResolvedValue(
        ok({ workspaceId: WORKSPACE, credential: JSON.stringify({ type: "header", name: "X-Crm-Service-Key", value: KEY }), webhookSecret: "", tokenExpiresAt: null }),
    )
    const ports: OpenApiConnectorPorts = {
        bindings: { ofProvider, recordOf: jest.fn().mockResolvedValue({ meta }) },
        clock: { now: () => new Date(now.ms) },
        secrets: { secretOf },
        client: { call, fetchSpec },
        host: { allowsPrivate: () => development, resolve },
        abilities: { accountsOfAgent },
    }
    const connector = new OpenApiConnectorService(CRM, SOURCES, ports)
    return { connector, ports, call, fetchSpec, accountsOfAgent, resolve, secretOf, ofProvider, now }
}

/** The params of a native refusal: the reason it gives. */
export interface NativeRefusalParams {
    readonly reason: string
}

/** The refusal a native call answers with: its code and the reason it carries. */
export interface NativeRefusal {
    readonly code: ToolsErrorCode
    readonly params: NativeRefusalParams
}

/** The refusal a native call answers with for a reason. */
export const refusal = (reason: string): NativeRefusal => ({ code: ToolsErrorCode.NativeRefused, params: { reason } })
