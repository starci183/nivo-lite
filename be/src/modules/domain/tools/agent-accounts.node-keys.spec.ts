import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ConnectionBindingsReadService, type ConnectionRecord } from "@modules/domain/connections"
import { AccountAttachmentsService, type ProviderAttachmentView } from "@modules/domain/tool-grants"
import { OPENAPI_PROVIDER } from "@modules/domain/openapi-tools"
import { pinnedMetaOf } from "@modules/domain/openapi-tools/openapi-account.policy"
import { ownersOfTool } from "@modules/domain/tool-specs"
import { NODE_REQUESTS_GATE } from "./node-requests.decorators"
import type { NodeMode, NodeRequest, NodeRequestsGate } from "./node-mode.policy"
import { PROVIDER_CATALOGUE, mutatesOf } from "./provider-abilities.policy"
import { AgentAccountsService } from "./agent-accounts.service"
import type { RightSeen } from "./right-origin.contracts"

/**
 * Defect 2 of the flip, at the judge: a template node lists the CRM by its provider key (`crm.nivoweb`), while the account it acts through
 * is an OpenAPI connection (`mcp_connector_access.provider` = `openapi`). The runner's bound list and the node-level judge read that account
 * as nodes name it (the CRM its pin was made for); an OpenAPI account pinned to none, or to another CRM, serves no CRM call.
 * The kill switch reads the attachment alone; the node's ONE mode is the gateway's (nivo-frame `rights`).
 * No stored row is rewritten: the attachment keeps its provider.
 */

const WS = "ws-1"
const AGENT = "agent-books"
const STEP = { nodeKey: "invoice-read", versionId: "v-1", workflowId: "wf-invoice" }
const NODE: RightSeen = { origin: "node", node: STEP }

/** The provider key of the CRM the pinned account serves. */
const CRM = "crm.nivoweb"

/** A WRITE operation of the CRM the OpenAPI provider serves (one ability per operation). */
const CRM_TOOL =
    PROVIDER_CATALOGUE.find((spec) => spec.provider === OPENAPI_PROVIDER)
        ?.abilities.flatMap((ability) => ability.tools)
        .find((tool) => ownersOfTool(tool).includes(CRM) && mutatesOf(tool)) ?? ""

/** The facts of an OpenAPI account pinned to a CRM (its provider key). */
const pinnedTo = (source: string): Readonly<Record<string, string>> =>
    pinnedMetaOf(
        {
            connector: source,
            swaggerUrl: "",
            workspaceHeader: "X-Nivo-Workspace",
            documentSha256: "c".repeat(64),
            live: true,
            pinnedBy: "owner",
            pinnedAt: "2026-11-12T00:00:00.000Z",
        },
        "{}",
    )

const recordOf = (id: string, meta: Readonly<Record<string, string>>): ConnectionRecord => ({
    id,
    workspaceId: WS,
    provider: OPENAPI_PROVIDER,
    name: id,
    meta,
    status: "connected",
    lastError: null,
    environment: "live",
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: null,
    createdAt: "2026-11-12T00:00:00.000Z",
})

/** The agent's OpenAPI accounts: one pinned to the CRM, one pinned to none. */
const CRM_ROW: ProviderAttachmentView = { agentId: AGENT, connectionId: "api-crm", provider: OPENAPI_PROVIDER }
const BARE_ROW: ProviderAttachmentView = { agentId: AGENT, connectionId: "api-bare", provider: OPENAPI_PROVIDER }
const ROWS: ReadonlyArray<ProviderAttachmentView> = [CRM_ROW, BARE_ROW]

/** What the node of the pinned template version declares: its mode, and the CRM under the source key. */
const requestOf = (mode: NodeMode): NodeRequest => ({
    mode,
    accounts: [{ kind: "records", provider: CRM, connectionId: null }],
})

const build = async (mode: NodeMode = "auto", attached: ReadonlyArray<ProviderAttachmentView> = ROWS) => {
    const rows = mock<AccountAttachmentsService>()
    rows.listOfAgent.mockResolvedValue(attached)
    const connections = mock<ConnectionBindingsReadService>()
    connections.recordOf.mockImplementation((_workspaceId, id) =>
        Promise.resolve(id === "api-crm" ? recordOf(id, pinnedTo(CRM)) : id === "api-bare" ? recordOf(id, {}) : null),
    )
    connections.ofProvider.mockResolvedValue([])
    const gate = mock<NodeRequestsGate>()
    gate.requestOf.mockResolvedValue(requestOf(mode))
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentAccountsService,
            { provide: AccountAttachmentsService, useValue: rows },
            { provide: AgentDirectoryService, useValue: mock<AgentDirectoryService>() },
            { provide: ConnectionBindingsReadService, useValue: connections },
            { provide: NODE_REQUESTS_GATE, useValue: gate },
        ],
    }).compile()
    return { service: moduleRef.get(AgentAccountsService), rows, gate }
}

describe("AgentAccountsService: an OpenAPI account as nodes name it", () => {
    it("the installation serves a CRM write tool on the OpenAPI provider", () => {
        expect(CRM_TOOL.startsWith("nivo.api.crm.nivoweb.")).toBe(true)
        expect(mutatesOf(CRM_TOOL)).toBe(true)
    })

    it("the runner's bound list at a step names the pinned account by its source and leaves the unpinned one out", async () => {
        const { service, rows, gate } = await build()

        await expect(service.boundAccountsOf(WS, AGENT, CRM_TOOL, NODE)).resolves.toEqual([
            { provider: CRM, connectionId: "api-crm" },
        ])
        expect(gate.requestOf).toHaveBeenCalledWith(WS, AGENT, STEP)
        // The attachment itself is never rewritten: it is read as stored.
        expect(rows.listOfAgent).toHaveBeenCalledWith(WS, AGENT)
        expect(ROWS.map((row) => row.provider)).toEqual([OPENAPI_PROVIDER, OPENAPI_PROVIDER])
    })

    it("the pinned account is the agent's attachment for the CRM tool, and it is the one the runner hands", async () => {
        await expect((await build("auto")).service.attachmentOf(WS, AGENT, CRM_TOOL)).resolves.toMatchObject({
            kind: "allow",
            connectionId: "api-crm",
        })
    })

    it("an account pinned to none serves no source, so nothing is bound at the step", async () => {
        const { service } = await build("auto", [BARE_ROW])

        await expect(service.boundAccountsOf(WS, AGENT, CRM_TOOL, NODE)).resolves.toEqual([])
        await expect(service.accountsOfAgent(WS, AGENT, CRM_TOOL, NODE)).resolves.toEqual([])
    })

    it("an agent attached to no OpenAPI account is not attached", async () => {
        const { service } = await build("auto", [])

        await expect(service.attachmentOf(WS, AGENT, CRM_TOOL)).resolves.toMatchObject({ kind: "refuse", reason: "not_attached" })
        await expect(service.boundAccountsOf(WS, AGENT, CRM_TOOL, NODE)).resolves.toEqual([])
    })
})
