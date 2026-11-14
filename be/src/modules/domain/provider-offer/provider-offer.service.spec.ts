import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { ToolRegistryService, PROVIDER_CATALOGUE, toolArgumentsSchema, type WorkspaceToolFamily } from "@modules/domain/tools"
import {
    OPENAPI_PROVIDER,
    OPENAPI_SOURCE_KEYS,
    installedDeclarationsOf,
    pinOf,
    type OpenApiToolDeclaration,
} from "@modules/domain/openapi-tools"
import { INTERFACE_READ_PROVIDERS, type InterfaceReadProvider } from "@modules/domain/workbench-door"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { WorkspaceEnterpriseService } from "@modules/domain/workspaces"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { ProviderOfferErrorCode } from "./errors/provider-offer.error"
import { ProviderOfferService } from "./provider-offer.service"

type StoredRecord = NonNullable<Awaited<ReturnType<ConnectionBindingsReadService["recordOf"]>>>

/** The code the members capability refuses a non-member with. */
const NOT_MEMBER = "WORKSPACE_MEMBERS_NOT_MEMBER"

const ACTOR = { principalId: "user-1", workspaceId: "ws-1" }

/** A stored connection of the workspace. */
const stored = (provider: StoredRecord["provider"], meta: Readonly<Record<string, string>> = {}): StoredRecord => ({
    id: "c-1",
    workspaceId: "ws-1",
    provider,
    name: "Account",
    meta,
    status: "connected",
    lastError: null,
    environment: "live",
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: null,
    createdAt: "2026-11-01T00:00:00.000Z",
})

/** The NIVO bank connector as the gateway registers it: one spec, with its English description and its arguments. */
const BANK_CONNECTOR: WorkspaceToolFamily = {
    manifest: {
        key: "bank",
        namespace: "nivo.tool.bank",
        name: "Bank",
        contractVersion: "bank-native@1",
        tools: [
            {
                name: "transaction.list",
                description: "Lists the bank movements of the attached accounts.",
                scope: "read",
                inputSchema: { type: "object", properties: { since: { type: "string", format: "date-time" }, limit: { type: "integer" } } },
                defaultMode: "auto",
                argumentSchema: toolArgumentsSchema,
            },
        ],
    },
    timeoutMs: 10_000,
}

/** A level-1 provider that offers only the state of its accounts, recording every call that would read an account. */
const accountsOnly = (provider: string): jest.Mocked<InterfaceReadProvider> => {
    const reader = mock<InterfaceReadProvider>()
    Object.assign(reader, { provider, freshness: "synced" })
    reader.readsOf.mockResolvedValue([])
    return reader
}

const build = async () => {
    const members = mock<WorkspaceMembersService>()
    const bindings = mock<ConnectionBindingsReadService>()
    const gateway = mock<ToolRegistryService>()
    gateway.familiesOf.mockReturnValue([BANK_CONNECTOR])
    const enterprise = mock<WorkspaceEnterpriseService>()
    enterprise.keyOf.mockResolvedValue(null)
    const readers = [accountsOnly("sepay"), accountsOnly("imap"), accountsOnly(OPENAPI_PROVIDER)]
    const moduleRef = await Test.createTestingModule({
        providers: [
            ProviderOfferService,
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: ConnectionBindingsReadService, useValue: bindings },
            { provide: ToolRegistryService, useValue: gateway },
            { provide: WorkspaceEnterpriseService, useValue: enterprise },
            { provide: INTERFACE_READ_PROVIDERS, useValue: readers },
        ],
    }).compile()
    return { service: moduleRef.get(ProviderOfferService), members, bindings, gateway, readers }
}

/** Where a CRM operation is served. */
interface OperationPlace {
    readonly method: string
    readonly path: string
}

/** The method and the path a CRM operation is served at: its name below the CRM's prefix, `get.customers.code` at `GET /customers/code`. */
const placeOf = (declaration: OpenApiToolDeclaration): OperationPlace => {
    const [method = "get", ...segments] = declaration.name.split(".")
    return { method, path: `/${segments.join("/")}` }
}

/**
 * The facts a pin stores for a CRM document that serves every given declaration under exactly its generated name (the document states
 * no server, so its base path is the root and an operation's path is its name's segments), the given write marked `money` by the document.
 */
const pinnedMetaOf = (
    declarations: ReadonlyArray<OpenApiToolDeclaration>,
    marked: OpenApiToolDeclaration | undefined,
): Readonly<Record<string, string>> => {
    // The account serves the CRM its declared tools belong to: data of the installed declarations, never a literal.
    const [connector = ""] = declarations.map((declaration) => declaration.connector)
    const paths: Record<string, Record<string, unknown>> = {}
    for (const declaration of declarations) {
        const { method, path } = placeOf(declaration)
        paths[path] = {
            ...paths[path],
            [method]: {
                operationId: declaration.name,
                ...(declaration === marked ? { "x-nivo-effect": "money" } : {}),
                responses: { "200": { description: "ok" } },
            },
        }
    }
    const document = { openapi: "3.0.3", info: { title: "CRM", version: "1.0.0" }, paths }
    const pinning = pinOf(
        {
            documentText: JSON.stringify(document),
            connector,
            swaggerUrl: "",
            workspaceHeader: "X-Workspace-Id",
            live: false,
            pinnedBy: "member-1",
            pinnedAt: "2026-11-12T00:00:00.000Z",
        },
        declarations,
    )
    return pinning.ok ? pinning.meta : {}
}

/** The tool ids the catalogue gives a provider, in its order. */
const catalogueToolsOf = (provider: string): ReadonlyArray<string> =>
    PROVIDER_CATALOGUE.find((spec) => spec.provider === provider)?.abilities.flatMap((ability) => ability.tools) ?? []

afterEach(() => {
    jest.restoreAllMocks()
})

describe("ProviderOfferService, providers written in code", () => {
    it("documents a bank feed: its info read, its catalogue tools with the gateway's spec, its transaction trigger; nothing read live", async () => {
        const { service, members, bindings, readers } = await build()
        bindings.recordOf.mockResolvedValue(stored("sepay"))

        const offer = await service.offerOf(ACTOR, "c-1")

        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
        expect(bindings.recordOf).toHaveBeenCalledWith("ws-1", "c-1")
        expect(offer).toMatchObject({ connectionId: "c-1", provider: "sepay" })
        expect(offer.api.map((read) => [read.name, read.shape, read.freshness])).toEqual([["nivo.api.sepay.info", "info", "synced"]])
        expect(offer.mcp.map((tool) => tool.id)).toEqual(catalogueToolsOf("sepay"))
        const list = offer.mcp.find((tool) => tool.id === TOOL.bankTransactionList)
        expect(list).toMatchObject({
            kind: "read",
            // The effect is a display label only: the manifest spec's own (`effect`) or the pinned document's; a core tool whose
            // manifest states none is unmarked (the engine derives no mark from a class).
            effect: null,
            description: "Lists the bank movements of the attached accounts.",
            operation: null,
        })
        expect(list?.parameters.map((member) => [member.name, member.type, member.format])).toEqual([
            ["since", "string", "date-time"],
            ["limit", "integer", null],
        ])
        expect(offer.triggers.map((trigger) => [trigger.name, trigger.kind, trigger.decided])).toEqual([["transaction.received", "webhook", true]])
        // Documentation only: no account figure is drawn and no read is run.
        for (const reader of readers) {
            expect(reader.read).not.toHaveBeenCalled()
            expect(reader.infoOf).not.toHaveBeenCalled()
        }
    })

    it("documents a mailbox: its info read, its two mail tools, its mail trigger batched by list", async () => {
        const { service, bindings } = await build()
        bindings.recordOf.mockResolvedValue(stored("imap"))

        const offer = await service.offerOf(ACTOR, "c-1")

        expect(offer.api.map((read) => read.name)).toEqual(["nivo.api.imap.info"])
        expect(offer.mcp.map((tool) => [tool.id, tool.kind])).toEqual([
            [TOOL.mailMessageList, "read"],
            [TOOL.mailMessageGet, "read"],
        ])
        expect(offer.triggers).toEqual([
            expect.objectContaining({ name: "mail.received", kind: "poll", batching: { mode: "list", maxEvents: 50 }, recovery: "cursor" }),
        ])
    })

    it("documents a messaging account: no level-1 read, the one customer send tool, no trigger", async () => {
        const { service, bindings } = await build()
        bindings.recordOf.mockResolvedValue(stored("zalo_oa"))

        const offer = await service.offerOf(ACTOR, "c-1")

        expect(offer.api).toEqual([])
        expect(offer.mcp.map((tool) => [tool.id, tool.kind, tool.effect])).toEqual([
            [TOOL.customerMessageSend, "write", null],
        ])
        expect(offer.triggers).toEqual([])
    })

})

describe("ProviderOfferService, the Swagger provider", () => {
    it("documents a Swagger account from its PINNED document: generated reads, each operation's method, path, state and marked effect", async () => {
        const { service, bindings, gateway } = await build()
        const declarations = OPENAPI_SOURCE_KEYS.flatMap((connector) => installedDeclarationsOf(connector))
        expect(declarations.length).toBeGreaterThan(0)
        const firstWrite = declarations.find((declaration) => !declaration.reads)
        bindings.recordOf.mockResolvedValue(stored(OPENAPI_PROVIDER, pinnedMetaOf(declarations, firstWrite)))
        gateway.familiesOf.mockReturnValue([])
        jest.spyOn(INSTALLED, "agentToolsOf").mockReturnValue(declarations.map((declaration) => declaration.tool))

        const offer = await service.offerOf(ACTOR, "c-1")

        expect(offer.api.map((read) => read.name)).toEqual([
            "nivo.api.openapi.info",
            // In the order of the pinned (canonical) document: its paths by code point.
            ...declarations
                .filter((declaration) => placeOf(declaration).method === "get")
                .toSorted((a, b) => (placeOf(a).path < placeOf(b).path ? -1 : 1))
                .map((declaration) => declaration.tool),
        ])
        expect(offer.api.slice(1).every((read) => read.freshness === "live")).toBe(true)
        expect(offer.mcp.map((tool) => tool.id)).toEqual(catalogueToolsOf(OPENAPI_PROVIDER))
        expect(offer.mcp.length).toBeGreaterThan(0)
        expect(
            offer.mcp.every((tool) => {
                const declaration = declarations.find((one) => one.tool === tool.id)
                return declaration !== undefined && tool.operation?.state === "ready" && tool.operation.path === placeOf(declaration).path
            }),
        ).toBe(true)
        // The marks are declared, never inferred (a display label only): the pinned write by its document's `x-nivo-effect`; every
        // other operation, which neither its document nor its manifest spec marks, stays unmarked.
        expect(firstWrite?.tool).toMatch(/^nivo.api.crm.[a-z][a-z0-9-]+.(post|put|patch|delete)./u)
        expect(offer.mcp.filter((tool) => tool.effect !== null).map((tool) => [tool.id, tool.effect])).toEqual([
            [firstWrite?.tool, "money"],
        ])
        expect(offer.triggers).toEqual([])
    })

    it("documents no Swagger tool or read that no plugin open to the workspace declares", async () => {
        const { service, bindings } = await build()
        bindings.recordOf.mockResolvedValue(stored(OPENAPI_PROVIDER))
        jest.spyOn(INSTALLED, "agentToolsOf").mockReturnValue([])

        const offer = await service.offerOf(ACTOR, "c-1")

        expect(offer.api.map((read) => read.name)).toEqual(["nivo.api.openapi.info"])
        expect(offer.mcp).toEqual([])
    })

})

describe("ProviderOfferService, who may read", () => {
    it("refuses a non-member before reading anything, and an account the workspace does not have", async () => {
        const { service, members, bindings } = await build()
        // The members capability refuses a person who is no member of the workspace.
        members.require.mockRejectedValueOnce({ code: NOT_MEMBER })

        await expect(service.offerOf(ACTOR, "c-1")).rejects.toMatchObject({ code: NOT_MEMBER })
        expect(bindings.recordOf).not.toHaveBeenCalled()

        bindings.recordOf.mockResolvedValue(null)
        await expect(service.offerOf(ACTOR, "c-other")).rejects.toMatchObject({
            code: ProviderOfferErrorCode.ConnectionNotFound,
            params: { connectionId: "c-other" },
        })
    })
})
