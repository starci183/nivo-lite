import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { AgentDirectoryService } from "@modules/domain/agents"
import { EntityEngineService } from "@modules/domain/entity-engine"
import { AgentAccountsService, NODE_REQUESTS_GATE } from "@modules/domain/tools"
import { AccountAttachmentsService } from "@modules/domain/tool-grants"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER, type Logger } from "@modules/platform/logging"
import { wireScope } from "@tests/fixtures/builders/agent-graph-records.builder"
import { AgentGraphRecordsService } from "./agent-graph-records.service"
import { AgentGraphsService } from "./agent-graphs.service"
import { AgentNodeRequestsService } from "./agent-node-requests.service"
import { AgentWorkflowRecordsService } from "./agent-workflow-records.service"

// The dev walk's finding 2: a run of a PRIMARY workflow is pinned to an AGENT GRAPH version id, a run of any other workflow to a
// WORKFLOW version id. The versions reader must resolve the same node request (its ONE mode and its providers in order) for both kinds
// of id, and for the workflow version that mirrors a graph version; the attachment check (`attachmentOf`: the kill switch) and the run-time binding
// (`boundAccountsOf`: the node's providers among the agent's attachments) must answer the same, whatever the pin. Proved on the REAL reader over the REAL
// `AgentGraphsService.versionAt` (its two stores doubled) and the REAL `AgentAccountsService`; the step's mode is the request's `mode`. No row is read: nothing is written at install.

const WS = "ws-1"
const AGENT = "agent-acc"
const APPEND = TOOL.ledgerEntryAppend

/**
 * A graph of this spec's own, the shape the reconcile graph of the Accounting template had (it left with the money, owner decision wave 4;
 * the spec proves the versions reader, not that template): its `ledger` step lists the books provider (Google) for the ledger append at its
 * ONE mode (`auto`, the exact match), `ledger-judged` the same at `ask`, and `match` lists the customer channels and the bank feeds.
 */
const FLOW: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "accounting",
    trigger: { kind: "tag", sources: ["agent"] },
    grant: { tools: [APPEND], effects: [] },
    nodes: [
        {
            key: "match",
            kind: "execute",
            step: "spec.match",
            mode: "auto",
            params: {},
            accounts: [
                { kind: "messaging", provider: "zalo_oa", connectionId: null, operations: { [TOOL.customerMessageSend]: "auto" } },
                { kind: "payment", provider: "sepay", connectionId: null, operations: {} },
            ],
        },
        {
            key: "ledger",
            kind: "execute",
            step: "spec.ledger",
            mode: "auto",
            params: {},
            accounts: [{ kind: "books", provider: "google", connectionId: null, operations: { [APPEND]: "auto" } }],
        },
        {
            key: "ledger-judged",
            kind: "execute",
            step: "spec.ledger",
            mode: "ask",
            params: {},
            accounts: [{ kind: "books", provider: "google", connectionId: null, operations: { [APPEND]: "ask" } }],
        },
    ],
}

/** The agent graph version a primary run is pinned to, its mirror among the workflow versions, and another workflow's version. */
const GRAPH_VERSION = "graph-version-1"
const MIRROR_VERSION = "workflow-version-mirror"
const OTHER_VERSION = "workflow-version-other"
const FOREIGN_VERSION = "graph-version-of-another-agent"
/** Two versions accepted LATER for the same workflow: one that still lists the books provider, one whose ledger step dropped it. */
const NEXT_VERSION = "workflow-version-next"
const NARROWED_VERSION = "workflow-version-narrowed"

/** The flow with the `ledger` step listing no provider: its mode is the node's own and it lists no account (a template no longer lists the pseudo-account `nivo`). */
const narrowed = (): GraphSpec => ({
    ...FLOW,
    nodes: FLOW.nodes.map((node) => (node.key === "ledger" ? { ...node, accounts: [] } : node)),
})

const build = async () => {
    const engine = mock<EntityEngineService>()
    wireScope(engine)
    const graphVersions = mock<AgentGraphRecordsService>()
    graphVersions.version.mockImplementation((_tx, versionId) => {
        const agentId = versionId === GRAPH_VERSION ? AGENT : versionId === FOREIGN_VERSION ? "agent-other" : null
        return Promise.resolve(
            agentId === null
                ? null
                : mock<NonNullable<Awaited<ReturnType<AgentGraphRecordsService["version"]>>>>({
                      id: versionId,
                      agentId,
                      number: 6,
                      document: { nodes: [], flow: FLOW },
                  }),
        )
    })
    const workflowVersions = mock<AgentWorkflowRecordsService>()
    workflowVersions.version.mockImplementation((_tx, versionId) =>
        Promise.resolve(
            [MIRROR_VERSION, OTHER_VERSION, NEXT_VERSION, NARROWED_VERSION].includes(versionId)
                ? mock<NonNullable<Awaited<ReturnType<AgentWorkflowRecordsService["version"]>>>>({
                      id: versionId,
                      agentId: AGENT,
                      number: 6,
                      document: Object.fromEntries(Object.entries(versionId === NARROWED_VERSION ? narrowed() : FLOW)),
                  })
                : null,
        ),
    )
    // The workflow version that published or adopted a graph version (its mirror), as the store answers it.
    workflowVersions.versionOfGraphVersion.mockImplementation((_tx, _agentId, graphVersionId) =>
        Promise.resolve(
            graphVersionId === GRAPH_VERSION
                ? mock<NonNullable<Awaited<ReturnType<AgentWorkflowRecordsService["versionOfGraphVersion"]>>>>({ id: MIRROR_VERSION })
                : null,
        ),
    )
    const access = mock<AccountAttachmentsService>()
    access.listOfAgent.mockResolvedValue([{ agentId: AGENT, connectionId: "sheet", provider: "google" }])
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphsService,
            AgentNodeRequestsService,
            AgentAccountsService,
            { provide: NODE_REQUESTS_GATE, useExisting: AgentNodeRequestsService },
            { provide: EntityEngineService, useValue: engine },
            { provide: AgentGraphRecordsService, useValue: graphVersions },
            { provide: AgentWorkflowRecordsService, useValue: workflowVersions },
            { provide: CLOCK, useValue: new FakeClock("2026-11-12T03:00:00.000Z") },
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: AccountAttachmentsService, useValue: access },
            { provide: AgentDirectoryService, useValue: mock<AgentDirectoryService>() },
        ],
    }).compile()
    return {
        requests: moduleRef.get(AgentNodeRequestsService),
        accounts: moduleRef.get(AgentAccountsService),
        graphs: moduleRef.get(AgentGraphsService),
    }
}

/** The three ways a run names its pinned version, each with the workflow it runs. */
const PINS = [
    ["a primary run pinned to the AGENT GRAPH version, routed by its workflow", GRAPH_VERSION, "wf-reconcile"],
    ["the WORKFLOW version that mirrors that graph version (the adopted primary workflow)", MIRROR_VERSION, "wf-reconcile"],
    ["a run of another workflow pinned to its own WORKFLOW version", OTHER_VERSION, "wf-other"],
] as const

/** The request the `ledger` step of the shipped flow answers: its ONE mode and the books provider. */
const LEDGER_REQUEST = { mode: "auto", accounts: [{ kind: "books", provider: "google", connectionId: null }] }

/** The attachment verdict on the books account attached as `sheet`: attached, no mode (the node's mode is its request's). */
const ON_SHEET = { kind: "allow", provider: "google", connectionId: "sheet" }

describe("the versions reader over both kinds of version id", () => {
    it("the template under test lists the books provider for the ledger append on its `ledger` steps, each at its step's mode", () => {
        expect(FLOW.nodes.find((node) => node.key === "ledger")?.accounts).toEqual([
            { kind: "books", provider: "google", connectionId: null, operations: { [APPEND]: "auto" } },
        ])
        expect(FLOW.nodes.find((node) => node.key === "ledger-judged")?.accounts).toEqual([
            { kind: "books", provider: "google", connectionId: null, operations: { [APPEND]: "ask" } },
        ])
    })

    it.each(PINS)(
        "%s: resolves the node's request at its ONE mode, the account is attached, and the binding names it",
        async (_name, versionId, workflowId) => {
            const { requests, accounts } = await build()
            const step = { nodeKey: "ledger", versionId, workflowId }
            const judged = { nodeKey: "ledger-judged", versionId, workflowId }

            await expect(requests.requestOf(WS, AGENT, step)).resolves.toEqual(LEDGER_REQUEST)
            // The `ask` step lists the same provider at its own mode: the request carries it, the attachment is the same.
            await expect(requests.requestOf(WS, AGENT, judged)).resolves.toEqual({ ...LEDGER_REQUEST, mode: "ask" })
            await expect(accounts.attachmentOf(WS, AGENT, APPEND)).resolves.toMatchObject(ON_SHEET)
            await expect(accounts.boundAccountsOf(WS, AGENT, APPEND, { origin: "node", node: step })).resolves.toEqual([
                { provider: "google", connectionId: "sheet" },
            ])
        },
    )

    it("the three pins answer the SAME request", async () => {
        const { requests } = await build()

        const answers = await Promise.all(
            PINS.map(([, versionId, workflowId]) => requests.requestOf(WS, AGENT, { nodeKey: "ledger", versionId, workflowId })),
        )

        expect(answers[1]).toEqual(answers[0])
        expect(answers[2]).toEqual(answers[0])
    })

    it.each(PINS)("%s: a tool of a provider the pinned node does not list binds no account", async (_name, versionId, workflowId) => {
        const { accounts } = await build()
        // The `match` step lists the customer channels and the bank feeds; the ledger append is the books provider's.
        const step = { nodeKey: "match", versionId, workflowId }

        await expect(accounts.boundAccountsOf(WS, AGENT, APPEND, { origin: "node", node: step })).resolves.toEqual([])
    })

    it("ONE id kind: a graph-version pin is named by the workflow version that mirrors it; a workflow version by itself", async () => {
        const { graphs } = await build()

        expect(await graphs.workflowVersionIdOf(WS, AGENT, GRAPH_VERSION)).toBe(MIRROR_VERSION)
        expect(await graphs.workflowVersionIdOf(WS, AGENT, MIRROR_VERSION)).toBe(MIRROR_VERSION)
        expect(await graphs.workflowVersionIdOf(WS, AGENT, OTHER_VERSION)).toBe(OTHER_VERSION)
        // A graph version no workflow version mirrors (a run of no workflow) stays what it is.
        expect(await graphs.workflowVersionIdOf(WS, AGENT, "graph-version-unmirrored")).toBe("graph-version-unmirrored")
    })

    it("accepting a new version that lists the same provider changes nothing of the request's or the binding's answer", async () => {
        const { requests, accounts } = await build()
        const before = { nodeKey: "ledger", versionId: MIRROR_VERSION, workflowId: "wf-reconcile" }
        const after = { nodeKey: "ledger", versionId: NEXT_VERSION, workflowId: "wf-reconcile" }

        const first = await requests.requestOf(WS, AGENT, before)
        const second = await requests.requestOf(WS, AGENT, after)

        expect(second).toEqual(first)
        expect(await accounts.boundAccountsOf(WS, AGENT, APPEND, { origin: "node", node: after })).toEqual(
            await accounts.boundAccountsOf(WS, AGENT, APPEND, { origin: "node", node: before }),
        )
    })

    it("a new version whose step DROPPED the provider binds no account at once", async () => {
        const { requests, accounts } = await build()
        const step = { nodeKey: "ledger", versionId: NARROWED_VERSION, workflowId: "wf-reconcile" }

        await expect(requests.requestOf(WS, AGENT, step)).resolves.toEqual({ mode: "auto", accounts: [] })
        await expect(accounts.boundAccountsOf(WS, AGENT, APPEND, { origin: "node", node: step })).resolves.toEqual([])
    })

    it("a version of another agent, and an id neither store knows, have no request (the write's mode is unknown) and bind no account", async () => {
        const { requests, accounts } = await build()

        for (const versionId of [FOREIGN_VERSION, "unknown-version"]) {
            const step = { nodeKey: "ledger", versionId, workflowId: "wf-reconcile" }
            expect(await requests.requestOf(WS, AGENT, step)).toBeNull()
            expect(await accounts.boundAccountsOf(WS, AGENT, APPEND, { origin: "node", node: step })).toEqual([])
        }
    })
})
