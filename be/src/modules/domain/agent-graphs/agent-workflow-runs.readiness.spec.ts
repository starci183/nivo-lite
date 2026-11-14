import { Test } from "@nestjs/testing"
import { AGENT_WORKFLOWS, workflowRecordOfRow } from "@tests/fixtures/builders/engine-core-tables.builder"
import { mock } from "@starci/jest-preset"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { TOOL, TRIGGER } from "@nivo-lite/agent-sdk/names"
import { ConnectionBindingsReadService, type ConnectionRecord } from "@modules/domain/connections"
import { INSTALLED } from "@modules/domain/installed-plugins"
import {
    AccountAttachmentsService,
    type ProviderAttachmentView,
} from "@modules/domain/tool-grants"
import { OPENAPI_PROVIDER, installedDeclarationsOf } from "@modules/domain/openapi-tools"
import { pinnedMetaOf } from "@modules/domain/openapi-tools/openapi-account.policy"
import { switchGated } from "@modules/domain/trigger-specs"
import {
    graphStateOf,
    ownerEdited,
    shopCreditGraph,
    templateGraph,
    workflowDoubles,
    type WorkflowDoubles,
} from "@tests/fixtures/builders/agent-workflows.builder"
import { AgentWorkflowAdoptionService } from "./agent-workflow-adoption.service"
import { AgentWorkflowRecordsService } from "./agent-workflow-records.service"
import { AgentWorkflowRunsService } from "./agent-workflow-runs.service"
import { AgentWorkflowStoreService } from "./agent-workflow-store.service"
import { AgentWorkflowsService } from "./agent-workflows.service"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import { WorkflowTriggerPicksService } from "./workflow-trigger-picks.service"

/**
 * Readiness at the one choke point (`runningOf`): a workflow whose graph is hidden takes no wake, no hand-off and no taker, and the
 * agent page reads why; a side node with no provider bound is named for the run's passed-over path. Without a grant store, or when
 * it cannot be read, nothing is hidden (today's behaviour).
 */

interface World extends WorkflowDoubles {
    readonly runs: AgentWorkflowRunsService
    readonly adoption: AgentWorkflowAdoptionService
    readonly access: ReturnType<typeof mock<AccountAttachmentsService>>
    readonly bindings: ReturnType<typeof mock<ConnectionBindingsReadService>>
    readonly picks: ReturnType<typeof mock<WorkflowTriggerPicksService>>
}

const buildWorld = async (withStore = true): Promise<World> => {
    const doubles = workflowDoubles([
        AgentWorkflowsService,
        AgentWorkflowAdoptionService,
        AgentWorkflowRunsService,
        AgentWorkflowStoreService,
        AgentWorkflowRecordsService,
    ])
    const access = mock<AccountAttachmentsService>()
    const bindings = mock<ConnectionBindingsReadService>()
    const picks = mock<WorkflowTriggerPicksService>()
    picks.picksOf.mockResolvedValue([])
    picks.record.mockImplementation((_workspaceId, _agentId, _member, written) => Promise.resolve(written.length))
    access.listOfAgent.mockResolvedValue([])
    bindings.recordOf.mockResolvedValue(null)
    const stores = withStore
        ? [
              { provide: AccountAttachmentsService, useValue: access },
              { provide: ConnectionBindingsReadService, useValue: bindings },
              { provide: WorkflowTriggerPicksService, useValue: picks },
          ]
        : []
    const moduleRef = await Test.createTestingModule({ providers: [...doubles.providers, ...stores] }).compile()
    return {
        ...doubles,
        runs: moduleRef.get(AgentWorkflowRunsService),
        adoption: moduleRef.get(AgentWorkflowAdoptionService),
        access,
        bindings,
        picks,
    }
}

/**
 * The graph this spec reads readiness of: the bank-credit workflow of `webbooks` (`webbooks.payment`: it wakes on the credit trigger of sepay
 * and casso, its first step reads the credit on them, its last is a side step on the CRM), with the owner's one change. Ledger (TOOLS-LEAD
 * 2026-11-13): it was the dropped accounting agent's reconcile graph; the builder's `shopAccountingGraph` is now the invoice template, which
 * listens on no bank feed, so this spec names the payment graph itself. Nothing is published here, so its hand-offs need no target.
 */
const shopAccountingGraph = (): GraphSpec => ownerEdited(templateGraph("webbooks.payment"))

const SEPAY = {
    kind: "payment",
    provider: "sepay",
    connectionId: null,
    operations: { [TOOL.paymentCreditList]: "auto" as const },
}
const BOOKS = {
    kind: "books",
    provider: "google",
    connectionId: null,
    operations: { [TOOL.ledgerEntryAppend]: "ask" as const },
}

/**
 * The shop's accounting graph whose FIRST node (blocking) reads the bank on sepay, and whose LAST node is a side node on the books; every
 * other node lists no accounts (the installed template's nodes now carry their own: they are taken off, so only these two are judged).
 */
const accountedGraph = (): GraphSpec => {
    const graph = shopAccountingGraph()
    const last = graph.nodes.length - 1
    return {
        ...graph,
        nodes: graph.nodes.map(({ accounts: _accounts, ...node }, at) => {
            if (at === 0) return { ...node, blocking: true, accounts: [SEPAY] }
            if (at === last) return { ...node, blocking: false, accounts: [BOOKS] }
            return node
        }),
    }
}

const sepay = (connectionId: string): ProviderAttachmentView => ({
    agentId: "agent-1",
    connectionId,
    provider: "sepay",
})

/** The agent's graph (what the primary workflow adopts) set to `flow`. */
const withGraph = (world: World, flow: GraphSpec): World => {
    world.graphs.stateOfAgent.mockResolvedValue(graphStateOf("graph-v1", flow))
    world.graphs.documentOf.mockResolvedValue({ nodes: [], flow })
    return world
}

const accounted = async (): Promise<World> => withGraph(await buildWorld(), accountedGraph())

/**
 * The shop's graph as before node rights: no node lists accounts, and no trigger listens through an account trigger switch (the
 * provider triggers, `kind: "provider"`, came with the switches, and readiness rightly reads attachments for them). Ledger (TOOLS-LEAD W2):
 * it was the accounting graph with its core bank road, which left the registry, so nothing of that graph is left once its switch-gated
 * triggers are off; the shop's credit graph (`sales.payment`) keeps its call trigger, which no switch gates.
 */
const unaccountedGraph = (): GraphSpec => {
    const graph = shopCreditGraph()
    return {
        ...graph,
        ...(graph.triggers === undefined ? {} : { triggers: graph.triggers.filter((trigger) => !switchGated(trigger.source)) }),
        nodes: graph.nodes.map(({ accounts: _accounts, ...node }) => node),
    }
}

/**
 * A credit on a bank feed account as the one event pipeline delivers it and the flow routes it (`routingScopeOf`): its verb and the
 * generic delivered scope (`eventId`, `accountId`, `data`). Ledger (E-RED 2026-11-14, the one trigger pipeline): it was the retired
 * emit point's tag (`source: "provider_trigger"`, `providerTrigger`, a top-level `connectionId` / `direction` / `transactionId`), which no
 * registration takes any more: every credit reaches a workflow through `deliver`, by its verb, its account and its `data`.
 */
const creditOn = (accountId: string): Readonly<Record<string, unknown>> => ({
    verb: TRIGGER.paymentCreditReceived,
    eventId: "tx-1",
    accountId,
    data: { transactionId: "tx-1", direction: "in", amountVnd: 150000, content: "DH001" },
})

const credit = (world: World) => world.runs.route("ws-1", "agent-1", { source: "trigger", scope: creditOn("s1"), pin: null })

describe("AgentWorkflowRunsService: readiness at runningOf", () => {
    it("routes to the workflow when its blocking node's provider is attached", async () => {
        const world = await accounted()
        world.access.listOfAgent.mockResolvedValue([sepay("s1")])

        await expect(credit(world)).resolves.toMatchObject({ agentId: "agent-1", versionId: "graph-v1" })
    })

    it("hides it when none is: no route, not counted as running, and the page reads what it waits for", async () => {
        const world = await accounted()

        await expect(credit(world)).resolves.toBeNull()
        const standing = await world.runs.standingOf("ws-1", "agent-1")
        expect(standing).toMatchObject({ total: 1, running: [] })
        const [workflow] = world.memory.rows(AGENT_WORKFLOWS)
        const readiness = await world.runs.readinessOf("ws-1", [workflow?.id ?? ""])
        expect([...readiness.values()]).toEqual([
            // Ledger (TOOLS-LEAD W2): the trigger side counted as able to fire through the core bank road ("always can"); with the road
            // gone, the credit trigger waits for one of the feeds it lists (sepay or casso) as well as the blocking node's sepay.
            {
                hidden: true,
                waitingFor: ["sepay", "casso"],
                blocked: [
                    { provider: "sepay", verb: "nivo.trigger.payment.credit.received", reason: "not_connected" },
                    { provider: "casso", verb: "nivo.trigger.payment.credit.received", reason: "not_connected" },
                ],
            },
        ])
    })

    it("shows a graph with an unbound side node, naming it skipped", async () => {
        const world = await accounted()
        world.access.listOfAgent.mockResolvedValue([sepay("s1")])
        await world.adoption.adoptAgentGraph("ws-1", "agent-1")

        const [workflow] = world.memory.rows(AGENT_WORKFLOWS)
        const readiness = await world.runs.readinessOf("ws-1", [workflow?.id ?? ""])
        const lastKey = accountedGraph().nodes.at(-1)?.key ?? ""
        expect([...readiness.values()]).toEqual([{ hidden: false, skipped: [lastKey] }])
    })

    it("two accounts of the provider and no default: shown and routed (the CALL picks its account or refuses TOOLS_ACCOUNT_NEEDS_PICK; readiness never hides for it)", async () => {
        const world = await accounted()
        world.access.listOfAgent.mockResolvedValue([sepay("s1"), sepay("s2")])

        await expect(credit(world)).resolves.toMatchObject({ agentId: "agent-1" })
        const [workflow] = world.memory.rows(AGENT_WORKFLOWS)
        const readiness = await world.runs.readinessOf("ws-1", [workflow?.id ?? ""])
        expect([...readiness.values()]).toEqual([{ hidden: false, skipped: [accountedGraph().nodes.at(-1)?.key ?? ""] }])
    })

    it("names an attached account whose provider refused the credential (`needs_reauth`) and hides nothing for it: a shown graph stays shown", async () => {
        const world = await accounted()
        world.access.listOfAgent.mockResolvedValue([sepay("s1")])
        world.bindings.recordOf.mockImplementation((_workspaceId, id) =>
            Promise.resolve(id === "s1" ? ({ id, provider: "sepay", status: "error", health: "needs_reauth" } as unknown as ConnectionRecord) : null),
        )

        await expect(credit(world)).resolves.toMatchObject({ agentId: "agent-1" })
        const [workflow] = world.memory.rows(AGENT_WORKFLOWS)
        const readiness = await world.runs.readinessOf("ws-1", [workflow?.id ?? ""])
        expect([...readiness.values()]).toEqual([
            { hidden: false, skipped: [accountedGraph().nodes.at(-1)?.key ?? ""], reconnect: [{ provider: "sepay", connectionId: "s1" }] },
        ])
    })

    it("hides nothing when the grant store cannot be read (logged) or the app has none", async () => {
        const world = await accounted()
        world.access.listOfAgent.mockRejectedValue(new Error("relation does not exist"))
        await expect(credit(world)).resolves.not.toBeNull()
        expect(world.logger.error).toHaveBeenCalled()

        const bare = withGraph(await buildWorld(false), accountedGraph())
        await expect(credit(bare)).resolves.not.toBeNull()
    })

    it("reads nothing for a graph none of whose nodes lists accounts (every graph from before node rights)", async () => {
        const world = withGraph(await buildWorld(), unaccountedGraph())
        // The subject: no trigger of it is switch-gated (Ledger, TOOLS-LEAD W2: it took the bank wake by its core road, which is gone; an
        // agent's call, which its call trigger takes, reaches it now).
        expect(unaccountedGraph().triggers?.length).toBeGreaterThan(0)
        expect(unaccountedGraph().triggers?.some((trigger) => switchGated(trigger.source))).toBe(false)

        const call = { source: "agent", scope: { authorAgentId: "agent-2" }, pin: null }
        await expect(world.runs.route("ws-1", "agent-1", call)).resolves.not.toBeNull()
        expect(world.access.listOfAgent).not.toHaveBeenCalled()
    })
})

describe("AgentWorkflowRunsService: the hidden target of a hand-off, and whether an agent holds workflows", () => {
    /** The key the adopted primary workflow of the world's agent is stored under. */
    const primaryKeyOf = (world: World): string => {
        const [workflow] = world.memory.rows(AGENT_WORKFLOWS).map(workflowRecordOfRow)
        return workflow?.key ?? ""
    }

    it("names what a hidden pinned target waits for; nothing once its provider is attached, for a key it does not run, or with no grant store", async () => {
        const world = await accounted()
        await expect(credit(world)).resolves.toBeNull()
        const pin = { workflow: primaryKeyOf(world), version: "latest" as const }
        expect(pin.workflow).not.toBe("")

        // Ledger (TOOLS-LEAD W2): its credit trigger now waits for one of its feeds too (the core bank road no longer "always fires").
        await expect(world.runs.hiddenTargetOf("ws-1", "agent-1", pin)).resolves.toMatchObject({
            workflow: pin.workflow,
            waitingFor: ["sepay", "casso"],
            blocked: [
                { provider: "sepay", reason: "not_connected" },
                { provider: "casso", reason: "not_connected" },
            ],
        })
        await expect(world.runs.hiddenTargetOf("ws-1", "agent-1", { ...pin, workflow: "ghost" })).resolves.toBeNull()
        world.access.listOfAgent.mockResolvedValue([sepay("s1")])
        await expect(world.runs.hiddenTargetOf("ws-1", "agent-1", pin)).resolves.toBeNull()
        const bare = withGraph(await buildWorld(false), accountedGraph())
        await expect(credit(bare)).resolves.not.toBeNull()
        await expect(bare.runs.hiddenTargetOf("ws-1", "agent-1", { ...pin, workflow: primaryKeyOf(bare) })).resolves.toBeNull()
    })

    it("an agent holds workflows once one is stored, whatever its readiness; one with none holds none", async () => {
        const world = await accounted()
        await expect(world.runs.holdsWorkflows("ws-1", "agent-1")).resolves.toBe(false)
        await credit(world)

        await expect(world.runs.holdsWorkflows("ws-1", "agent-1")).resolves.toBe(true)
        await expect(world.runs.holdsWorkflows("ws-1", "agent-2")).resolves.toBe(false)
    })
})

describe("AgentWorkflowRunsService.sideNodeWaiting", () => {
    it("names the providers of an unbound side node; nothing for a blocking node or a node with no accounts", async () => {
        const world = await buildWorld()
        const scope = { workspaceId: "ws-1", agentId: "agent-1", workflowId: "wf-1" }

        await expect(
            world.runs.sideNodeWaiting(scope, { key: "book", step: "x", blocking: false, accounts: [BOOKS] }),
        ).resolves.toEqual(["google"])
        await expect(
            world.runs.sideNodeWaiting(scope, { key: "read", step: "x", blocking: true, accounts: [SEPAY] }),
        ).resolves.toBeNull()
        await expect(world.runs.sideNodeWaiting(scope, { key: "old", step: "x", blocking: false })).resolves.toBeNull()
        expect(world.access.listOfAgent).toHaveBeenCalledTimes(1)
    })
})

/** The provider key of the CRM the installed NIVO Web package is written against (`PROVIDER.crm("nivoweb")`): what its nodes list in `accounts`. */
const CRM = "crm.nivoweb"

/**
 * A REAL installed template graph whose blocking node lists the CRM by its provider key (`crm.nivoweb`), read as the engine stores it (the
 * adapter carries every node's accounts): the first such graph of the NIVO Web plugin.
 */
const crmGraph = (): GraphSpec | undefined =>
    INSTALLED.templateAgents()
        .flatMap((agent) => agent.graphs.map((graph) => templateGraph(graph.key)))
        .find((graph) =>
            graph.nodes.some((node) => node.blocking !== false && node.accounts?.some((entry) => entry.provider === CRM) === true),
        )

/** Every operation the installed packages call on the CRM, by its one name (`nivo.api.crm.nivoweb.get.prices`). */
const declaredOps = (): ReadonlyArray<string> => installedDeclarationsOf(CRM).map((declaration) => declaration.tool)

/**
 * The OpenAPI document of a CRM that serves the given operations: one path per name under `/v1` (the base path the server states), so
 * the pin reads each back under exactly that name. `unsupported` lists the operations that use a cookie parameter (a feature the pin
 * cannot call), which the pin keeps but nothing can run.
 */
const crmDocumentOf = (ops: ReadonlyArray<string>, unsupported: ReadonlyArray<string> = []): string => {
    const prefix = `nivo.api.${CRM}.`
    const paths: Record<string, Record<string, unknown>> = {}
    for (const op of ops) {
        const [method = "get", ...segments] = op.slice(prefix.length).split(".")
        const path = `/v1/${segments.join("/")}`
        const operation = unsupported.includes(op)
            ? { parameters: [{ name: "session", in: "cookie", schema: { type: "string" } }], responses: {} }
            : { responses: {} }
        paths[path] = { ...paths[path], [method]: operation }
    }
    return JSON.stringify({
        openapi: "3.0.3",
        info: { title: "Synthetic CRM", version: "1.0.0" },
        servers: [{ url: "https://crm.example.test/v1" }],
        paths,
    })
}

/**
 * An OpenAPI connection pinned to the CRM `crm.nivoweb` whose snapshot serves every operation the installed packages call, but the ones
 * left out (absent from the document) and the ones marked unsupported.
 */
const crmPinned = (id: string, without: ReadonlyArray<string> = [], unsupported: ReadonlyArray<string> = []): ConnectionRecord => ({
    id,
    workspaceId: "ws-1",
    provider: OPENAPI_PROVIDER,
    name: "CRM",
    meta: pinnedMetaOf(
        {
            connector: CRM,
            swaggerUrl: "",
            workspaceHeader: "X-Nivo-Workspace",
            documentSha256: "d".repeat(64),
            live: true,
            pinnedBy: "owner",
            pinnedAt: "2026-11-12T00:00:00.000Z",
        },
        crmDocumentOf(
            declaredOps().filter((op) => !without.includes(op)),
            unsupported,
        ),
    ),
    status: "connected",
    lastError: null,
    environment: "live",
    sandbox: false,
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: null,
    createdAt: "2026-11-12T00:00:00.000Z",
})

describe("AgentWorkflowRunsService: readiness of a real template graph (its accounts carried by the adapter)", () => {
    const graph = crmGraph()

    /** One attachment of every provider the graph's nodes list but NIVO's own and the CRM. */
    const othersOf = (flow: GraphSpec): ReadonlyArray<ProviderAttachmentView> =>
        [...new Set(flow.nodes.flatMap((node) => (node.accounts ?? []).map((entry) => entry.provider ?? "")))]
            .filter((provider) => provider !== "" && provider !== "nivo" && provider !== CRM)
            .map((provider) => ({ agentId: "agent-1", connectionId: `${provider}-1`, provider }))

    const readinessOfGraph = async (world: World) => {
        await world.adoption.adoptAgentGraph("ws-1", "agent-1")
        const [workflow] = world.memory.rows(AGENT_WORKFLOWS)
        return [...(await world.runs.readinessOf("ws-1", [workflow?.id ?? ""])).values()]
    }

    /** The graph attached to an agent that holds `others` and one OpenAPI connection whose record is `record` (none: a bare connection). */
    const worldWith = async (flow: GraphSpec, record: ConnectionRecord | null): Promise<World> => {
        const world = withGraph(await buildWorld(), flow)
        world.access.listOfAgent.mockResolvedValue([
            ...othersOf(flow),
            { agentId: "agent-1", connectionId: record?.id ?? "api-bare", provider: OPENAPI_PROVIDER },
        ])
        world.bindings.recordOf.mockImplementation((_workspaceId, id) => Promise.resolve(id === record?.id ? record : null))
        return world
    }

    /** The first CRM operation a blocking node of the graph calls: the one a case takes away from the pin. */
    const operationOfGraph = (flow: GraphSpec): string => {
        const ops = new Set(declaredOps())
        const called = flow.nodes
            .filter((node) => node.blocking !== false && node.accounts?.some((entry) => entry.provider === CRM) === true)
            .flatMap((node) => INSTALLED.templateNodeOf(node.step)?.tools ?? [])
            .find((tool) => ops.has(tool))
        if (called === undefined) throw new TypeError("a blocking node of the graph calls a CRM operation")
        return called
    }

    it("the plugin ships one", () => {
        expect(graph).toBeDefined()
    })

    it("hides the graph while no account serves the CRM, naming `crm.nivoweb`: an OpenAPI account pinned to none serves none", async () => {
        if (graph === undefined) throw new TypeError("a template graph lists the CRM")
        const world = await worldWith(graph, null)

        const [readiness] = await readinessOfGraph(world)
        expect(readiness).toMatchObject({ hidden: true, waitingFor: [CRM], blocked: [{ provider: CRM, reason: "not_connected" }] })
    })

    it("shows it once an OpenAPI account pinned to the CRM is attached and its snapshot holds every operation the packages call", async () => {
        if (graph === undefined) throw new TypeError("a template graph lists the CRM")
        const world = await worldWith(graph, crmPinned("api-crm"))

        const [readiness] = await readinessOfGraph(world)
        expect(readiness).toMatchObject({ hidden: false })
    })

    it("blocks a node with `tool_unavailable`, naming the operation, while the attached snapshot lacks an operation it calls", async () => {
        if (graph === undefined) throw new TypeError("a template graph lists the CRM")
        const missing = operationOfGraph(graph)
        const world = await worldWith(graph, crmPinned("api-crm", [missing]))

        const [readiness] = await readinessOfGraph(world)
        expect(readiness).toMatchObject({
            hidden: true,
            waitingFor: [CRM],
            blocked: [{ provider: CRM, reason: "tool_unavailable", tool: missing }],
        })
    })

    it("blocks it too while the snapshot holds the operation with a feature the provider cannot call, and is ready again once it is supported", async () => {
        if (graph === undefined) throw new TypeError("a template graph lists the CRM")
        const odd = operationOfGraph(graph)

        const unsupported = await worldWith(graph, crmPinned("api-crm", [], [odd]))
        const [blocked] = await readinessOfGraph(unsupported)
        expect(blocked).toMatchObject({ hidden: true, blocked: [{ provider: CRM, reason: "tool_unavailable", tool: odd }] })

        const supported = await worldWith(graph, crmPinned("api-crm"))
        const [ready] = await readinessOfGraph(supported)
        expect(ready).toMatchObject({ hidden: false })
    })

    it("a graph is hidden by its blocking node's provider (readiness reads the carried accounts)", async () => {
        const reconcile = templateGraph("webbooks.payment")
        const world = withGraph(await buildWorld(), reconcile)

        const [readiness] = await readinessOfGraph(world)
        expect(readiness).toMatchObject({ hidden: true })
        expect(readiness?.hidden === true ? readiness.waitingFor : []).toEqual(expect.arrayContaining(["sepay", "casso", CRM]))
    })
})

describe("AgentWorkflowRunsService: one source per stream (owner key triggerOneSource2026_11_12, CORRECTED)", () => {
    const VERB = "nivo.trigger.payment.credit.received"
    /** The shop's reconcile graph with no node accounts (only its triggers are judged): the core bank road, SePay's and Casso's feeds. */
    const creditGraph = (): GraphSpec => {
        const graph = shopAccountingGraph()
        return { ...graph, nodes: graph.nodes.map(({ accounts: _accounts, ...node }) => node) }
    }
    const casso = (connectionId: string): ProviderAttachmentView => ({
        agentId: "agent-1",
        connectionId,
        provider: "casso",
    })
    /** A bank feed connection whose public facts name one bank account. */
    const feed = (id: string, provider: "sepay" | "casso", account: string): ConnectionRecord => ({
        id,
        workspaceId: "ws-1",
        provider,
        name: id,
        meta: { bank_code: "VCB", account_number: account, account_masked: `•••• ${account.slice(-4)}` },
        status: "connected",
        lastError: null,
        environment: "live",
        sandbox: false,
        isDefault: false,
        lastEventAt: null,
        firstEvent: null,
        createdBy: null,
        createdAt: "2026-11-12T00:00:00.000Z",
    })
    const bankWorld = async (sepayAccount: string, cassoAccount: string): Promise<World> => {
        const world = withGraph(await buildWorld(), creditGraph())
        world.access.listOfAgent.mockResolvedValue([sepay("s1"), casso("c1")])
        const records = new Map([
            ["s1", feed("s1", "sepay", sepayAccount)],
            ["c1", feed("c1", "casso", cassoAccount)],
        ])
        world.bindings.recordOf.mockImplementation((_workspaceId, id) => Promise.resolve(records.get(id) ?? null))
        await world.adoption.adoptAgentGraph("ws-1", "agent-1")
        return world
    }
    const route = (world: World, scope: Readonly<Record<string, unknown>>) =>
        world.runs.route("ws-1", "agent-1", { source: "trigger", scope, pin: null })
    /** A feed's credit as the pipeline delivers it: the account names the feed (Ledger E-RED: was the retired emit point's tag). */
    const feedCredit = (_provider: "sepay" | "casso", connectionId: string) => creditOn(connectionId)
    const workflowIdOf = (world: World): string => world.memory.rows(AGENT_WORKFLOWS)[0]?.id ?? ""

    // Ledger (TOOLS-LEAD W2): the core-road credit of each case below left with the core bank road; the feeds' credits stay.
    it("SePay and Casso on DIFFERENT bank accounts: both feeds route, no pick read", async () => {
        const world = await bankWorld("111", "222")
        await expect(route(world, feedCredit("sepay", "s1"))).resolves.not.toBeNull()
        await expect(route(world, feedCredit("casso", "c1"))).resolves.not.toBeNull()
        expect(world.picks.picksOf).not.toHaveBeenCalled()
    })

    it("on the SAME bank account with no pick: hidden, nothing routes, the page names the stream and its accounts", async () => {
        const world = await bankWorld("0111 222", "0111222")
        await expect(route(world, feedCredit("sepay", "s1"))).resolves.toBeNull()
        await expect(route(world, feedCredit("casso", "c1"))).resolves.toBeNull()
        const readiness = await world.runs.readinessOf("ws-1", [workflowIdOf(world)])
        const stream = "bank-account:VCB:0111222"
        expect([...readiness.values()]).toEqual([
            {
                hidden: true,
                waitingFor: ["sepay", "casso"],
                blocked: [
                    { provider: "sepay", verb: "nivo.trigger.payment.credit.received", reason: "needs_pick", stream, connectionIds: ["s1", "c1"] },
                    { provider: "casso", verb: "nivo.trigger.payment.credit.received", reason: "needs_pick", stream, connectionIds: ["s1", "c1"] },
                ],
            },
        ])
    })

    it("after the founder picks Casso: Casso's credit routes, SePay's takes nothing", async () => {
        const world = await bankWorld("111", "111")
        world.picks.picksOf.mockResolvedValue([{ verb: VERB, stream: "bank-account:VCB:111", connectionId: "c1" }])
        await expect(route(world, feedCredit("casso", "c1"))).resolves.not.toBeNull()
        await expect(route(world, feedCredit("sepay", "s1"))).resolves.toBeNull()
        expect(world.picks.picksOf).toHaveBeenCalledWith("ws-1", "agent-1", workflowIdOf(world))
    })

    it("after the founder picks SePay: its feed routes, Casso's credit takes nothing", async () => {
        const world = await bankWorld("111", "111")
        world.picks.picksOf.mockResolvedValue([{ verb: VERB, stream: "bank-account:VCB:111", connectionId: "s1" }])
        await expect(route(world, feedCredit("sepay", "s1"))).resolves.not.toBeNull()
        await expect(route(world, feedCredit("casso", "c1"))).resolves.toBeNull()
    })

    it("a single attached account fires with no pick: its credit routes", async () => {
        const world = withGraph(await buildWorld(), creditGraph())
        world.access.listOfAgent.mockResolvedValue([sepay("s1")])
        await expect(route(world, feedCredit("sepay", "s1"))).resolves.not.toBeNull()
        expect(world.picks.picksOf).not.toHaveBeenCalled()
    })

    describe("the writer: triggerPicksOf checks each pick against the stream the accounts contest", () => {
        it("takes a pick of an account that reads a contested stream", async () => {
            const world = await bankWorld("111", "111")
            const workflowId = workflowIdOf(world)
            await expect(
                world.runs.triggerPicksOf("ws-1", "agent-1", [
                    { workflowId, verb: VERB, stream: "bank-account:VCB:111", connectionId: "c1" },
                ]),
            ).resolves.toEqual([{ workflowId, verb: VERB, stream: "bank-account:VCB:111", connectionId: "c1" }])
        })

        it("refuses a pick for a stream no two accounts read, an account outside the stream, or a workflow not of the agent", async () => {
            const refused = new AgentGraphsError({ code: AgentGraphsErrorCode.TriggerPickRefused })
            const differ = await bankWorld("111", "222")
            const workflowId = workflowIdOf(differ)
            await expect(
                differ.runs.triggerPicksOf("ws-1", "agent-1", [
                    { workflowId, verb: VERB, stream: "bank-account:VCB:111", connectionId: "s1" },
                ]),
            ).rejects.toMatchObject({ code: refused.code })
            const same = await bankWorld("111", "111")
            const sameId = workflowIdOf(same)
            await expect(
                same.runs.triggerPicksOf("ws-1", "agent-1", [
                    { workflowId: sameId, verb: VERB, stream: "bank-account:VCB:111", connectionId: "s9" },
                ]),
            ).rejects.toMatchObject({ code: refused.code })
            await expect(
                same.runs.triggerPicksOf("ws-1", "agent-1", [
                    { workflowId: "00000000-0000-4000-8000-00000000dead", verb: VERB, stream: "bank-account:VCB:111", connectionId: "c1" },
                ]),
            ).rejects.toMatchObject({ code: refused.code })
        })
    })
})
