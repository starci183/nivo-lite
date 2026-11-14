import { readFileSync } from "node:fs"
import { join } from "node:path"
import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { defineEffect, defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { TOOL, TRIGGER } from "@nivo-lite/agent-sdk/names"
import { graphSpecSchema } from "@nivo-lite/agent-sdk/graph"
import { z } from "zod"
import { coreNodeIndex } from "@modules/domain/installed-plugins/installed-plugins.testing"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { AgentRunsService } from "@modules/domain/agent-runs"
import { AccountDataReadService, AccountDataTypesService } from "@modules/domain/account-data"
import { ConnectionBindingsReadService } from "@modules/domain/connections"
import { AgentWorkHandlersService } from "@modules/domain/agent-work"
import { PROVIDER_TRIGGER_TAG_SOURCE, triggerDeclarations } from "@modules/domain/provider-triggers"
import type { TriggerDeclaration } from "@modules/domain/provider-triggers/trigger-declaration.contracts"
import type { AgentTurnView, AgentWakeContext } from "@modules/domain/agent-work"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { runViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { agentTurnViewOf } from "@tests/fixtures/builders/agent-work.builder"
import { stateOf } from "@tests/fixtures/builders/agent-graph.builder"
import { seededWorkflowsOf, workflowWorldOf } from "@tests/fixtures/builders/workflow-world.builder"
import type { ModuleName } from "@tests/fixtures/builders/workflow-world.builder"
import { AgentGraphsService } from "./agent-graphs.service"
import type { GraphState } from "./agent-graphs.service"
import { AgentGraphFlowRunsService } from "./agent-graph-flow-runs.service"
import { AgentGraphRawRowsService } from "./agent-graph-raw-rows.service"
import type { FlowThreadRun, FlowThreads } from "./agent-graph-flow-runs.service"
import { AgentWorkflowRunsService } from "./agent-workflow-runs.service"
import { AgentGraphWakeNoticesService } from "./agent-graph-wake-notices.service"
import { flowProblemsOf } from "./policies/flow.policy"
import { tagSourceOf, triggerScopeOf } from "./policies/graph-flow.policy"
import type { FlowWake } from "./policies/graph-flow.policy"

/** The agent each module's workflows are seeded for in the routed worlds. */
const agentOf = (module: ModuleName): string => `${module}-agent`

/** A step of the spec that only records an order: every effect it runs can be undone, which no shipped node is any more. */
const RECORD_ONLY = "spec.record-order" as const

const FLOW: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    trigger: { kind: "tag", sources: ["agent"] },
    grant: { tools: [], effects: [TOOL.agentTag] },
    nodes: [
        { key: "keep", kind: "output", step: RECORD_ONLY, next: "end" },
        { key: "end", kind: "output", step: "stop" },
    ],
}

/**
 * The spec's record-only step: it records an order and nothing else. Before the flip it was the core package's `defineNode` order step
 * narrowed to the record; since the flip every shipped business step is a template node, so the step is the spec's own `defineNode`.
 */
const RECORD_ONLY_NODE: NodeDefinition = defineNode({
    id: RECORD_ONLY,
    role: "output",
    title: { vi: "Ghi \u0111\u01a1n", en: "Record the order" },
    params: z.object({}),
    input: z.object({}),
    output: z.object({}),
    effects: [TOOL.agentTag],
    requires: [TOOL.agentTag],
    run: () => Promise.resolve({}),
    examples: [{ name: "one", params: {}, input: {}, output: {}, effects: [] }],
})

/** The one effect the record-only step runs, as an effect that can be undone: the saga kind of its step is then compensable. */
const UNDOABLE_EFFECT = defineEffect({
    id: TOOL.agentTag,
    title: { key: "t" },
    payload: z.object({}),
    compensation: TOOL.teamMessagePost,
})

/** The installed nodes (the core package's control nodes), with the spec's own record-only step and its undoable effect beside them. */
const installedNodes = () => {
    const index = coreNodeIndex()
    return {
        ...index,
        nodes: new Map<string, NodeDefinition>([...index.nodes, [RECORD_ONLY, RECORD_ONLY_NODE]]),
        effects: new Map([...index.effects, [TOOL.agentTag, UNDOABLE_EFFECT]]),
    }
}

/** Where the seed keeps its graph files, from this folder. */
const SEEDS_DIR = "../../../../../.starcistacks/dev/seeds/data/graphs"

/** The graph of a module as the seed ships it, parsed by the SDK's own schema. */
const seededGraphOf = (name: ModuleName): GraphSpec =>
    graphSpecSchema.parse(JSON.parse(readFileSync(join(__dirname, SEEDS_DIR, `${name}.json`), "utf8")))

/**
 * A SePay credit as the one emit point hands it to an agent (`ProviderTriggersService.deliver`): the provider trigger's tag, whose plain
 * data names the provider trigger, the account, the direction and the transaction.
 */
const creditTag = (transactionId: string): AgentWakeContext => ({
    text: "sepay:transaction.received",
    tagSource: PROVIDER_TRIGGER_TAG_SOURCE,
    subject: `bank-transaction:${transactionId}`,
    // Ledger (ROAD Opus-1f, R44): the movement is the event's `data` (generic scope), which the credit narrowing reads by path.
    tagContext: JSON.stringify({
        data: { transactionId, direction: "in" },
        providerTrigger: "sepay:transaction.received",
        connectionId: "sepay-1",
        role: "decider",
    }),
})

const TURN = agentTurnViewOf({
    source: "tag",
    context: { authorAgentId: "agent-2", text: "order" },
})

const stateWith = (flow: GraphSpec | undefined, versionId: string | null = "version-1"): GraphState =>
    stateOf({
        activeVersionId: versionId,
        active: { nodes: [], ...(flow === undefined ? {} : { flow }) },
    })

/** What the world is built with: the agent's own graph and the routing over seeded workflows. */
interface BuildOptions {
    readonly workflows?: AgentWorkflowRunsService
    readonly notices?: AgentGraphWakeNoticesService
    /** The engine's raw message rows by id (the value as stored), of connection `conn-1`: what a channel wake that names its entrance reads. */
    readonly rows?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
}

const build = async (state: GraphState | null, options: BuildOptions = {}) => {
    const graphs = mock<AgentGraphsService>({ stateOfAgent: jest.fn().mockResolvedValue(state) })
    const runs = mock<AgentRunsService>({ open: jest.fn().mockResolvedValue(runViewOf({ id: "run-1" })) })
    const handlers = mock<AgentWorkHandlersService>()
    const nodes = mock<GraphNodeRegistryService>({ installed: jest.fn().mockReturnValue(installedNodes()) })
    const stored = options.rows
    const accountRows = mock<AccountDataReadService>({
        byId: jest.fn((_type: string, id: string) =>
            Promise.resolve(stored?.[id] === undefined ? null : ({ id, connectionId: "conn-1", value: stored[id] } as never)),
        ),
    })
    const accountTypes = mock<AccountDataTypesService>({
        all: jest.fn().mockReturnValue([{ name: "zalo_oa.event", purpose: "chat.event" }, { name: "zalo_oa.message", purpose: "chat.message" }]),
    })
    const accountConnections = mock<ConnectionBindingsReadService>({ recordOf: jest.fn().mockResolvedValue({ id: "conn-1" }) })
    const tx = fakeTransaction(mockEntityManager())
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphFlowRunsService,
            ...(stored === undefined
                ? []
                : [
                      AgentGraphRawRowsService,
                      { provide: AccountDataReadService, useValue: accountRows },
                      { provide: AccountDataTypesService, useValue: accountTypes },
                      { provide: ConnectionBindingsReadService, useValue: accountConnections },
                  ]),
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: AgentGraphsService, useValue: graphs },
            { provide: AgentRunsService, useValue: runs },
            { provide: AgentWorkHandlersService, useValue: handlers },
            { provide: GraphNodeRegistryService, useValue: nodes },
            ...(options.workflows === undefined
                ? []
                : [{ provide: AgentWorkflowRunsService, useValue: options.workflows }]),
            ...(options.notices === undefined ? [] : [{ provide: AgentGraphWakeNoticesService, useValue: options.notices }]),
        ],
    }).compile()
    return { flows: moduleRef.get(AgentGraphFlowRunsService), runs, handlers, accountRows }
}

/** The thread runs as the flow sees them: every run they are handed is kept, in order. */
const threadsOf = (over: Partial<FlowThreads> = {}) => {
    const started: Array<FlowThreadRun> = []
    const threads = mock<FlowThreads>({
        owns: jest.fn().mockReturnValue(false),
        opened: jest.fn().mockResolvedValue(undefined),
        started: jest.fn((run: FlowThreadRun) => {
            started.push(run)
            return Promise.resolve({ status: "done" as const, reason: null, outcome: { runId: run.runId } })
        }),
        woken: jest.fn().mockResolvedValue({ status: "done", reason: null, outcome: { runId: "run-9" } }),
        ...over,
    })
    return { threads, started }
}

describe("AgentGraphFlowRunsService", () => {
    it("sets itself as the drain's flow once the app has started", async () => {
        const { flows, handlers } = await build(null)
        flows.onModuleInit()
        expect(handlers.setFlow).toHaveBeenCalledWith(flows)
    })

    it("takes a wake whose origin the active flow's trigger names, and no other", async () => {
        await expect((await build(stateWith(FLOW))).flows.takes(TURN)).resolves.toBe(true)
        // Ledger (TOOLS-LEAD W2): the other origin was a tag naming only a conversation, which no producer writes (it names no verb, so
        // the flow now takes it to report it); a clock slot is the real wake of an origin this flow's trigger does not name.
        const schedule = agentTurnViewOf({ source: "schedule", context: { triggerId: "trig-1", slot: "1700000000000" } })
        await expect((await build(stateWith(FLOW))).flows.takes(schedule)).resolves.toBe(false)
        await expect((await build(stateWith(undefined))).flows.takes(TURN)).resolves.toBe(false)
        await expect((await build(stateWith(FLOW, null))).flows.takes(TURN)).resolves.toBe(false)
        await expect((await build(null)).flows.takes(TURN)).resolves.toBe(false)
    })

    it("takes a provider event whose verb only a `wait` of the agent lists; with no waiter it starts nothing and ends `no_waiter`, untold", async () => {
        const render = (renderId: string, provider = "shotstack") =>
            agentTurnViewOf({
                source: "tag",
                context: {
                    text: `${provider}:render.completed`,
                    tagSource: PROVIDER_TRIGGER_TAG_SOURCE,
                    subject: `video-render:${renderId}`,
                    tagContext: JSON.stringify({
                        renderRowId: `row-${renderId}`,
                        renderId,
                        status: "done",
                        providerTrigger: `${provider}:render.completed`,
                        connectionId: "video-1",
                        role: "notice",
                    }),
                },
            })
        const notices = mock<AgentGraphWakeNoticesService>()
        const workflows = mock<AgentWorkflowRunsService>({
            route: jest.fn().mockResolvedValue(null),
            holdsWorkflows: jest.fn().mockResolvedValue(true),
            waitVerbsOf: jest.fn().mockResolvedValue(new Set(["nivo.trigger.video.render.completed"])),
        })
        const { flows, runs } = await build(stateWith(FLOW), { workflows, notices })
        flows.setThreads(threadsOf().threads)

        await expect(flows.takes(render("r-1"))).resolves.toBe(true)
        await expect(flows.run(render("r-1"))).resolves.toEqual({ status: "skipped", reason: "no_waiter", outcome: null })
        expect(runs.open).not.toHaveBeenCalled()
        expect(notices.untaken).not.toHaveBeenCalled()
        expect(notices.unroutable).not.toHaveBeenCalled()
        // A bank credit the agent neither heads nor waits on is not its event.
        await expect(flows.takes(agentTurnViewOf({ source: "tag", context: creditTag("tx-1") }))).resolves.toBe(false)
    })

    it("skips a wake when the agent no longer runs a flow, and reads a step of an uninstalled or stop node", async () => {
        const { flows, runs } = await build(stateWith(undefined))
        flows.setThreads(threadsOf().threads)
        await expect(flows.run(TURN)).resolves.toEqual({ status: "skipped", reason: "no_flow", outcome: null })
        expect(runs.open).not.toHaveBeenCalled()
        const input = { versionId: "v", nodeKey: "end", trigger: {} }
        expect(flows.stepOf({ key: "end", kind: "output", step: "stop" }, input).effect).toEqual({ kind: "read" })
    })

    it("keys the projected step of a node by the node, with the saga kind of what it runs", async () => {
        const { flows } = await build(stateWith(FLOW))
        const node = FLOW.nodes[0]
        if (node === undefined) throw new Error("FLOW has no first node")
        const input = { versionId: "version-1", nodeKey: "keep", trigger: { text: "order" }, namespace: "sales.main" }

        expect(flows.stepOf(node, input)).toEqual({
            stepKey: "keep",
            nodeKey: "keep",
            kind: "graph_node",
            effect: { kind: "compensable", compensation: "graph_node" },
            input,
        })
        expect(
            flows.stepOf(node, { ...input, item: { value: "a", index: 2, key: "a-2" }, loop: { nodeKey: "each", index: 2, items: [] } })
                .stepKey,
        ).toBe("each[a-2].keep")
    })
})

describe("AgentGraphFlowRunsService and the thread runs, the one engine", () => {
    it("opens the wake's run as a thread's and drives it under the wake's lease: no step row is written by the flow", async () => {
        const { flows, runs } = await build(stateWith(FLOW))
        const { threads } = threadsOf()
        flows.setThreads(threads)
        const lease = new AbortController().signal

        await expect(flows.run(TURN, lease)).resolves.toEqual({
            status: "done",
            reason: null,
            outcome: { runId: "run-1" },
        })

        expect(runs.open).toHaveBeenCalledWith(expect.anything(), {
            workspaceId: "ws-1",
            agentId: "agent-1",
            wakeId: "wake-1",
            trigger: "tag",
            versionId: "version-1",
            context: { ...TURN.context, threadScope: "conversation:conv-1" },
            // A tag's wake is keyed by no event subject: the run holds none (one run in flight per subject applies to pipeline keys).
            subject: null,
        })
        expect(threads.opened).toHaveBeenCalledWith(expect.anything(), "ws-1", "run-1")
        expect(threads.started).toHaveBeenCalledWith(
            {
                turn: TURN,
                runId: "run-1",
                versionId: "version-1",
                flow: FLOW,
                namespace: "sales.main",
                workflowId: null,
                workflowVersion: null,
                trigger: {
                    authorAgentId: "agent-2",
                    text: "order",
                    subject: null,
                    source: "agent",
                    origin: "agent",
                    locale: "vi",
                },
            },
            lease,
        )
    })

    it("goes on as a thread when the wake is tried again: nothing asks which engine the run started on", async () => {
        const { flows, runs } = await build(stateWith(FLOW))
        const { threads } = threadsOf({})
        flows.setThreads(threads)

        await flows.run(agentTurnViewOf({ ...TURN, attempts: 2 }))

        expect(runs.open).toHaveBeenCalledTimes(1)
        expect(threads.started).toHaveBeenCalledTimes(1)
    })

    it("fails a workflow wake that reaches it before the thread engine registered: no run is opened, nothing runs anywhere else", async () => {
        const { flows, runs } = await build(stateWith(FLOW))

        await expect(flows.run(TURN)).rejects.toMatchObject({ code: "AGENT_GRAPHS_ENGINE_MISSING" })

        expect(runs.open).not.toHaveBeenCalled()
    })

    it("takes a wake the thread runs own and hands it over before anything else", async () => {
        const { flows, runs } = await build(null)
        const { threads } = threadsOf({ owns: jest.fn().mockReturnValue(true) })
        flows.setThreads(threads)
        const wake = agentTurnViewOf({
            source: "internal",
            context: { eventName: "engine.thread.resume", subjectId: "run-9" },
        })
        const lease = new AbortController().signal

        await expect(flows.takes(wake)).resolves.toBe(true)
        await expect(flows.run(wake, lease)).resolves.toEqual({
            status: "done",
            reason: null,
            outcome: { runId: "run-9" },
        })

        expect(threads.woken).toHaveBeenCalledWith(wake, lease)
        expect(runs.open).not.toHaveBeenCalled()
    })
})

describe("AgentGraphFlowRunsService.triggerOf", () => {
    // Ledger (ROAD Opus-1d, 2026-11-14): the half about a `customer` wake that names no entrance is gone with the `customer` wake source
    // (deleted, owner rule R28); a customer line is a pipeline wake, whose reads the next describe pins.
    it("keeps a tag's own words and reads no words from any store", async () => {
        const { flows, accountRows } = await build(stateWith(FLOW), { rows: {} })

        await expect(flows.triggerOf(TURN)).resolves.toMatchObject({ text: "order" })
        expect(accountRows.byId).not.toHaveBeenCalled()
    })
})

describe("AgentGraphFlowRunsService.triggerOf: a wake of the one event pipeline", () => {
    /** A channel line as its source declares it: the raw inbox row value, translated purely into the event (ROAD-API 1.1). */
    const LINE_RAW = z.object({ userId: z.string(), messageId: z.string(), text: z.string(), at: z.string() })
    const LINE_DATA = z.object({ messageKey: z.string(), text: z.string(), at: z.string().nullable() })
    const LINE: TriggerDeclaration<z.infer<typeof LINE_RAW>, z.infer<typeof LINE_DATA>> = {
        provider: "zalo_oa",
        name: "flow-runs-spec.message",
        verb: TRIGGER.zaloMessageReceived,
        via: "webhook",
        raw: LINE_RAW,
        data: LINE_DATA,
        translate: (raw, origin) => ({
            id: `${origin.connectionId ?? ""}:${raw.messageId}`,
            subject: { channel: "zalo", id: raw.userId, name: "Lan" },
            data: { messageKey: `zalo:${raw.messageId}`, text: raw.text, at: raw.at },
        }),
        key: { by: "subject" },
    }
    triggerDeclarations.register(LINE)
    const WAKE = agentTurnViewOf({
        source: "trigger",
        context: {
            verb: TRIGGER.zaloMessageReceived,
            eventId: "conn-1:m-2",
            declaration: "zalo_oa:flow-runs-spec.message",
            workflowId: "wf-front",
            connectionId: "conn-1",
            contactId: "contact-1",
            conversationId: "route-1",
            rawType: "zalo_oa.event",
            rawRowId: "row-2",
            filesJson: JSON.stringify([{ id: "f-1", name: "bidv.jpg", contentType: "image/jpeg", url: "chat-file:f-1" }, { nope: true }]),
        },
    })
    const ROWS = { "row-2": { userId: "user-1", messageId: "m-2", text: "Transfer done", at: "2026-11-04T01:00:05.000Z" } }

    it("hands the GENERIC scope: the person on the account and the data the source's translate gives the stored row, no chatbot record", async () => {
        const { flows, accountRows } = await build(stateWith(FLOW), { rows: ROWS })

        const trigger = await flows.triggerOf(WAKE)

        expect(accountRows.byId).toHaveBeenCalledWith("zalo_oa.event", "row-2")
        expect(trigger).toEqual({
            eventId: "conn-1:m-2",
            accountId: "conn-1",
            contactId: "contact-1",
            routeId: "route-1",
            subject: { channel: "zalo", id: "user-1", name: "Lan" },
            data: {
                messageKey: "zalo:m-2",
                text: "Transfer done",
                at: "2026-11-04T01:00:05.000Z",
                files: [{ id: "f-1", name: "bidv.jpg", contentType: "image/jpeg", url: "chat-file:f-1" }],
            },
        })
    })

    it("a workflow call of the pipeline: the mapped params are `data`, the caller (agent, run) is named, the pin stays on the wake", async () => {
        const { flows } = await build(stateWith(FLOW), { rows: {} })
        const call = agentTurnViewOf({
            source: "trigger",
            context: {
                verb: TRIGGER.workflowCalled,
                eventId: "call-1",
                contactId: "c-1",
                authorAgentId: "agent-chatbot",
                dataJson: JSON.stringify({ orderId: "o-1" }),
                tagContext: JSON.stringify({ workflowCall: { workflow: "consult", version: "latest" }, params: { orderId: "o-1" }, caller: { runId: "run-caller" } }),
            },
        })

        await expect(flows.triggerOf(call)).resolves.toMatchObject({
            eventId: "call-1",
            contactId: "c-1",
            data: { orderId: "o-1" },
            caller: { agent: "agent-chatbot", runId: "run-caller" },
        })
    })

    it("carries the data of a source with no raw row, and gives empty data when the row is gone", async () => {
        const { flows } = await build(stateWith(FLOW), { rows: {} })
        const resume = agentTurnViewOf({
            source: "trigger",
            context: { verb: TRIGGER.zaloMessageReceived, eventId: "resume:route-1:1", conversationId: "route-1", connectionId: "conn-1", dataJson: JSON.stringify({ resume: "held", text: "" }) },
        })
        await expect(flows.triggerOf(resume)).resolves.toMatchObject({ routeId: "route-1", data: { resume: "held", text: "" } })
        await expect(flows.triggerOf(WAKE)).resolves.toMatchObject({ routeId: "route-1", data: { files: [{ id: "f-1" }] } })
    })
})

describe("flow F graphs on fake ports", () => {
    const installed = coreNodeIndex()
    // Ledger (TOOLS-LEAD 2026-11-13): the accounting agent is dropped (its seed file and its three workflows are gone); chatbot and sales stay.
    const modules: ReadonlyArray<ModuleName> = ["chatbot", "sales"]

    it("pass the installed nodes with the saga rule on, in every workflow the seed makes active for an agent", () => {
        const seeded = modules.flatMap((module) => seededWorkflowsOf(agentOf(module), module))
        expect(seeded.map((workflow) => workflow.templateId)).toEqual([
            "chatbot.front-desk",
            "chatbot.team-chat",
            // In the installed Sales agent's graph list (`sales.agent.ts`); its primary, the consult, first.
            "sales.consult",
            "sales.payment",
            "sales.after-sale",
            "sales.delivery-check",
            "sales.occasion",
            "sales.web-order",
            "sales.team-chat",
        ])
        expect(seeded.find((workflow) => workflow.templateId.startsWith("sales.") && workflow.primary)?.templateId).toBe("sales.consult")
        // A seeded workflow is a template agent's graph since the flip: judged as the seed's check judges it (`flowProblemsOf`: the @2
        // checks for a template flow, the `@1` ones with the saga rule for any other).
        for (const workflow of seeded) expect(flowProblemsOf(workflow.graph, installed)).toEqual([])
    })

    // Out of date after a template change: `npm run seeds:graphs` (from the lane root, after the blocks-core build) rewrites them.
    it("keep the seed's agent graph files the newest version of the primary template of their module", () => {
        for (const name of modules) {
            const primary = seededWorkflowsOf(agentOf(name), name).find((workflow) => workflow.primary)
            expect(seededGraphOf(name)).toEqual(primary?.graph)
        }
    })
})

/**
 * The wake of the end hand-off a workflow writes for another, as the delivery writes it (`ProviderTriggersService.deliver`, the
 * `workflow.called` trigger): the verb, ONLY the params it maps as the event's data, the pin of the target and the caller.
 * Ledger (ROAD Opus-1d, 2026-11-14): this was a tag wake of source `tag`; ruling R30 delivers every call through `deliver` and the tag
 * door's call road is deleted, so the wake is now written as the delivery writes it. Every assertion keeps its meaning.
 */
const handOffWake = (workflow: string, params: Readonly<Record<string, unknown>>, text: string = ""): FlowWake => {
    const context: AgentWakeContext = {
        verb: TRIGGER.workflowCalled,
        eventId: `call:${workflow}:${text}`,
        dataJson: JSON.stringify(params),
        tagContext: JSON.stringify({
            workflowCall: { workflow, version: "latest" },
            params,
            caller: { runId: "run-caller" },
        }),
        authorAgentId: "chatbot-1",
    }
    return { source: "trigger", actorMemberId: null, context }
}

/** The key of the trigger of a module's primary seeded workflow that listens on a source kind (`zalo`, `sepay`), or null. */
const triggerKeyOf = (module: ModuleName, kind: string): string | null =>
    seededWorkflowsOf(agentOf(module), module)
        .find((workflow) => workflow.primary)
        ?.graph.triggers?.find((trigger) => trigger.source.kind === kind)?.key ?? null

/** The key of the trigger of one seeded workflow (by its template) that listens on a source kind, or null. */
const triggerKeyOfTemplate = (module: ModuleName, templateId: string, kind: string): string | null =>
    seededWorkflowsOf(agentOf(module), module)
        .find((workflow) => workflow.templateId === templateId)
        ?.graph.triggers?.find((trigger) => trigger.source.kind === kind)?.key ?? null

/** How a wake was routed: how its start ended, the workflow its run was pinned to, and the run the thread engine was handed. */
interface Routed {
    readonly ending: unknown
    readonly workflow: string | null
    readonly run: FlowThreadRun | null
}

/**
 * Hands a wake to the REAL start of the run of an agent whose workflows were seeded from the templates: the real routing picks the
 * workflow (by the pin of a hand-off, else by a trigger's source, channel and conditions), the run is opened, pinned and handed to the
 * thread runs (a double here), which is where the routing ends.
 */
const routed = async (
    module: ModuleName,
    wake: FlowWake,
    rows: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {},
): Promise<Routed> => {
    const world = workflowWorldOf({
        [agentOf("chatbot")]: "chatbot",
        [agentOf("sales")]: "sales",
    })
    const { flows } = await build(null, { rows, workflows: world.service })
    const { threads, started } = threadsOf()
    flows.setThreads(threads)
    const turn = agentTurnViewOf({
        agentId: agentOf(module),
        source: wake.source,
        actorMemberId: wake.actorMemberId,
        context: structuredClone(wake.context),
    })
    const ending = await flows.run(turn)
    return {
        ending,
        workflow: world.pins.get("run-1")?.workflowId.split(":").at(-1) ?? null,
        run: started.at(0) ?? null,
    }
}

describe("routing a wake through the workflows of an agent", () => {
    const customerLine = (channel: "zalo" | "telegram"): FlowWake => ({
        source: "trigger",
        actorMemberId: null,
        // As the one delivery function writes it: the producer names the verb, the route and the account ride as ids.
        context: {
            verb: channel === "zalo" ? TRIGGER.zaloMessageReceived : TRIGGER.telegramMessageReceived,
            eventId: `${channel}:1`,
            conversationId: "conv-1",
            connectionId: "conn-1",
        },
    })
    const line = { "msg-1": { text: "mua hoa", at: "2026-11-04T01:00:00.000Z" } }

    it("takes a customer line of Zalo or Telegram with the front desk's matching trigger, and the line is trigger.text", async () => {
        const zalo = await routed("chatbot", customerLine("zalo"), line)
        const telegram = await routed("chatbot", customerLine("telegram"), line)

        expect([zalo.workflow, telegram.workflow]).toEqual(["front-desk", "front-desk"])
        expect(zalo.run?.namespace).toBe("chatbot.front-desk")
        // A template graph's triggers are keyed by the graph (the adapter's `t1`, `t2`, …): the key is the one of the front desk's
        // trigger on that channel.
        // The generic scope: the person's route and account; the words are the data its source's translate gives the raw row.
        expect(zalo.run?.trigger).toMatchObject({ triggerKey: triggerKeyOf("chatbot", "zalo"), routeId: "conv-1", accountId: "conn-1" })
        expect(telegram.run?.trigger).toMatchObject({ triggerKey: triggerKeyOf("chatbot", "telegram") })
    })

    it("takes a hand-off by its pin: only the mapped params and the calling run reach trigger.*, whatever the wake's source", async () => {
        const words = "One flower pot to 69 Hang Xanh please"
        const consult = await routed(
            "sales",
            handOffWake("consult", { leadId: "lead-1", conversationId: "conv-1", text: words, channel: "zalo" }, words),
        )

        expect(consult.workflow).toBe("consult")
        expect(consult.run?.namespace).toBe("sales.consult")
        expect(consult.run?.workflowId).toBe("sales-agent:consult")
        // The callee's inputs are its scope's `data` (the rebuilt callee graphs read `trigger.data.*`).
        expect(consult.run?.trigger).toMatchObject({
            data: { leadId: "lead-1", conversationId: "conv-1", text: words, channel: "zalo" },
            caller: { agent: "chatbot-1", runId: "run-caller" },
        })
        const afterSale = await routed("sales", handOffWake("after-sale", { orderId: "o-1" }))
        expect(afterSale.workflow).toBe("after-sale")
        expect(afterSale.run?.trigger).toMatchObject({ data: { orderId: "o-1" } })
        expect(afterSale.run?.trigger).not.toHaveProperty("data.items")
    })

    // Ledger (TOOLS-LEAD 2026-11-13): these two cases were about the dropped accounting agent's `reconcile` workflow; the living stand-in is the
    // `sales` agent's `payment` workflow (a bank credit wakes it by its SePay trigger; it hands the paid order on to `after-sale` inside the
    // same agent). Every assertion keeps its meaning.
    // Ledger (TOOLS-LEAD W2): the credit was a hand-built tag (`tagSource: sepay`, no producer's) that only the road-only match let the
    // retired core SePay road take; it is now the provider trigger's tag the emit point writes, taken by the SePay provider trigger.
    it("sends a bank credit to the payment workflow by its SePay trigger, with the transaction the provider trigger hands", async () => {
        const wake: FlowWake = { source: "tag", actorMemberId: null, context: creditTag("t-9") }
        const run = await routed("sales", wake)

        expect(run.workflow).toBe("payment")
        expect(run.run?.trigger).toMatchObject({
            triggerKey: triggerKeyOfTemplate("sales", "sales.payment", "provider"),
            data: { transactionId: "t-9" },
        })
    })

    it("sends a customer's word that they paid to the payment workflow by the pin of the Chatbot's hand-off", async () => {
        const text = "I transferred 5k"
        const run = await routed(
            "sales",
            handOffWake("payment", { leadId: "lead-1", conversationId: "conv-1", text, channel: "zalo" }, text),
        )

        expect(run.workflow).toBe("payment")
        expect(run.run?.trigger).toMatchObject({ data: { conversationId: "conv-1", text, leadId: "lead-1" } })
    })
})

describe("routing a wake by the conditions of a trigger", () => {
    it("sends a care timer to the workflow whose condition its careKind meets, and a timer of no workflow starts nothing", async () => {
        // A timer of the one pipeline (Opus-2's timer entry on `deliver`): the verb and its data; the graphs register on
        // `data.data.kind` (sales care timers). The payment reminder is no timer workflow any more: it is the sale's wait timeout.
        const timer = (careKind: string): FlowWake => ({
            source: "trigger",
            actorMemberId: null,
            context: {
                verb: TRIGGER.timerDue,
                eventId: `task-${careKind}:2026-11-04T10:00:00.000Z`,
                dataJson: JSON.stringify({
                    taskId: `task-${careKind}`,
                    ref: "order-1",
                    dueAt: "2026-11-04T10:00:00.000Z",
                    careKind,
                    data: { kind: careKind, record: "order-1" },
                }),
            },
        })
        const kinds = ["delivery-check", "occasion"]
        const runs = await Promise.all(kinds.map((kind) => routed("sales", timer(kind))))
        const unknown = await routed("sales", timer("loyalty"))

        expect(runs.map((run) => run.workflow)).toEqual(["delivery-check", "occasion"])
        expect(unknown.ending).toEqual({ status: "skipped", reason: "no_flow", outcome: null })
        expect(unknown.workflow).toBeNull()
        expect(unknown.run).toBeNull()
    })

    it("answers a hand-off to a workflow the agent does not run with nothing: the agent has no graph of its own that answers instead", async () => {
        const run = await routed("sales", handOffWake("ghost", { orderId: "o-1" }))

        expect(run.ending).toEqual({ status: "skipped", reason: "no_flow", outcome: null })
        expect(run.workflow).toBeNull()
        expect(run.run).toBeNull()
    })

    // The payment workflow's input contract has no `channel` (the line leaves through the conversation's own account), and the Chatbot's
    // hand-off maps none. Ledger (TOOLS-LEAD 2026-11-13): it hands "paid" words to Sales' `payment` (it was Accounting's `reconcile`).
    it("the Chatbot passes the customer's words and conversation to Sales as the mapped params of its payment hand-off, and no channel", () => {
        const chatbot = seededWorkflowsOf(agentOf("chatbot"), "chatbot").find((workflow) => workflow.primary)
        const handoff = chatbot?.graph.nodes.find((node) => node.key === "to-payment")

        expect(handoff?.params).toMatchObject({
            agent: "sales",
            workflow: "payment",
            inputs: {
                conversationId: { $ref: "trigger.routeId" },
                text: { $ref: "steps.hear.output.text" },
            },
        })
        expect(handoff?.params).not.toHaveProperty("inputs.channel")
    })
})

describe("the origin of the wakes the connections start", () => {
    // Ledger (ROAD Opus-1d, 2026-11-14): the case of an inbound message as a `customer` wake (channel origin) is deleted with the `customer`
    // wake source (owner rule R28); an inbound line is a pipeline wake of its channel's verb, routed by "takes a customer line of Zalo
    // or Telegram" above.

    // Ledger (TOOLS-LEAD W2): the tag was the retired core bank road's (`bank_feed`); a credit now reaches the agent as the provider
    // trigger's tag of its bank feed.
    it("takes the tag a bank feed's provider trigger writes for a new credit as a system event, which the sales payment graph's trigger accepts", () => {
        const wake: FlowWake = { source: "tag", actorMemberId: null, context: creditTag("tx-1") }

        expect(tagSourceOf(wake)).toBe("system-event")
        const payment = seededWorkflowsOf(agentOf("sales"), "sales").find((workflow) => workflow.templateId === "sales.payment")
        expect(payment?.graph.trigger.sources).toContain(tagSourceOf(wake))
        expect(triggerScopeOf(wake)).toMatchObject({
            origin: "system-event",
            source: PROVIDER_TRIGGER_TAG_SOURCE,
            subject: { kind: "bank-transaction", id: "tx-1" },
            data: { transactionId: "tx-1" },
        })
    })
})

describe("a wake no workflow takes: the agent's own graph answers only for a legacy agent, never past readiness", () => {
    /** The agent's own graph, woken from every source: were it to answer, every wake below would run it. */
    const OWN: GraphSpec = {
        ...FLOW,
        trigger: { kind: "tag", sources: ["agent", "channel", "chats-group", "system-event", "schedule"] },
    }
    const HIDDEN = {
        workflow: "consult",
        name: "Consult",
        waitingFor: ["sepay"],
        blocked: [{ provider: "sepay", reason: "not_connected" as const }],
    }

    /** The routing of an agent none of whose workflows takes the wake; `holds` says whether it holds any, `hidden` the pinned target. */
    const routing = (holds: boolean, hidden: typeof HIDDEN | null = null) =>
        mock<AgentWorkflowRunsService>({
            route: jest.fn().mockResolvedValue(null),
            holdsWorkflows: jest.fn().mockResolvedValue(holds),
            hiddenTargetOf: jest.fn().mockResolvedValue(hidden),
            standingOf: jest.fn().mockResolvedValue({ total: holds ? 2 : 0, running: [], sources: [] }),
        })

    const world = async (holds: boolean, hidden: typeof HIDDEN | null = null) => {
        const notices = mock<AgentGraphWakeNoticesService>()
        const workflows = routing(holds, hidden)
        const built = await build(stateWith(OWN), { workflows, notices })
        const { threads, started } = threadsOf()
        built.flows.setThreads(threads)
        return { ...built, notices, workflows, started }
    }

    const handOff = agentTurnViewOf({
        source: "tag",
        context: {
            text: "x",
            authorAgentId: "chatbot-1",
            conversationId: "conv-1",
            tagContext: JSON.stringify({ workflowCall: { workflow: "consult", version: "latest" }, params: {}, caller: { runId: "run-caller" } }),
        },
    })
    const unpinned: ReadonlyArray<readonly [string, ReturnType<typeof agentTurnViewOf>]> = [
        ["a schedule", agentTurnViewOf({ source: "schedule", context: { text: "close" } })],
        // Ledger (TOOLS-LEAD W2): was a hand-built tag (`tagSource: sepay`) of no producer; the provider trigger's real tag.
        ["a provider trigger", agentTurnViewOf({ source: "tag", context: creditTag("t-1") })],
        ["a team chat line", agentTurnViewOf({ source: "tag", actorMemberId: "member-1", context: { text: "hi" } })],
        ["an agent's tag", TURN],
    ]

    it("refuses a hand-off pinned to a workflow readiness hides: nothing runs, the founder is told what it waits for, the wake is not taken", async () => {
        const subject = await world(true, HIDDEN)

        await expect(subject.flows.takes(handOff)).resolves.toBe(false)
        await expect(subject.flows.run(handOff)).resolves.toEqual({ status: "skipped", reason: "call_target_hidden", outcome: null })
        expect(subject.started).toEqual([])
        expect(subject.runs.open).not.toHaveBeenCalled()
        expect(subject.notices.refused).toHaveBeenCalledWith(handOff, {
            code: "call_target_hidden",
            workflow: "Consult",
            waitingFor: ["sepay"],
        })
    })

    it("the drain's report of that untaken hand-off names the refusal, never a bare 'not ready'", async () => {
        const subject = await world(true, HIDDEN)

        await subject.flows.stuck(handOff, "agent_not_ready")

        expect(subject.notices.refused).toHaveBeenCalledTimes(1)
        expect(subject.notices.failed).not.toHaveBeenCalled()
        const plain = await world(true)
        await plain.flows.stuck(handOff, "agent_not_ready")
        expect(plain.notices.failed).toHaveBeenCalledWith(handOff, "agent_not_ready")
    })

    it("a hand-off pinned to a workflow the agent does not run goes nowhere, even for a legacy agent with a graph of its own", async () => {
        for (const holds of [true, false]) {
            const subject = await world(holds)

            await expect(subject.flows.takes(handOff)).resolves.toBe(false)
            await expect(subject.flows.run(handOff)).resolves.toEqual({ status: "skipped", reason: "no_flow", outcome: null })
            expect(subject.started).toEqual([])
            expect(subject.notices.refused).not.toHaveBeenCalled()
        }
    })

    it.each(unpinned)("%s of an agent that holds workflows is answered by none of them, never by its own graph", async (_kind, turn) => {
        const subject = await world(true)

        await expect(subject.flows.takes(turn)).resolves.toBe(false)
        await expect(subject.flows.run(turn)).resolves.toEqual({ status: "skipped", reason: "no_flow", outcome: null })
        expect(subject.started).toEqual([])
    })

    it("a customer line of an agent that holds workflows, none taking it, is told to the founder and never runs the agent's own graph", async () => {
        const subject = await world(true)
        const line = agentTurnViewOf({
            source: "trigger",
            context: { verb: TRIGGER.zaloMessageReceived, eventId: "m-1", conversationId: "conv-1", connectionId: "conn-1" },
        })

        await expect(subject.flows.run(line)).resolves.toEqual({ status: "skipped", reason: "no_workflow", outcome: null })
        expect(subject.started).toEqual([])
        expect(subject.notices.untaken).toHaveBeenCalledTimes(1)
    })

    it.each(unpinned)("%s of a LEGACY agent (a graph of its own, no workflow) is answered by its own graph, unpinned, as before", async (_kind, turn) => {
        const subject = await world(false)

        await expect(subject.flows.takes(turn)).resolves.toBe(true)
        await expect(subject.flows.run(turn)).resolves.toMatchObject({ status: "done" })
        expect(subject.started.map((run) => [run.namespace, run.workflowId])).toEqual([["sales.main", null]])
    })
})

describe("a wake no verb is derived for starts nothing and is told once (every wake carries a verb)", () => {
    /** The agent's own graph woken from every road, and workflows that would take anything: neither may run a wake of no verb. */
    const OWN: GraphSpec = { ...FLOW, trigger: { kind: "tag", sources: ["agent", "channel", "chats-group", "system-event", "schedule"] } }

    const world = async (holds: boolean) => {
        const notices = mock<AgentGraphWakeNoticesService>()
        const workflows = mock<AgentWorkflowRunsService>({
            route: jest.fn().mockResolvedValue(null),
            holdsWorkflows: jest.fn().mockResolvedValue(holds),
            hiddenTargetOf: jest.fn().mockResolvedValue(null),
            standingOf: jest.fn().mockResolvedValue({ total: holds ? 2 : 0, running: [], sources: [] }),
        })
        const built = await build(stateWith(OWN), { workflows, notices })
        const { threads, started } = threadsOf()
        built.flows.setThreads(threads)
        return { ...built, notices, workflows, started }
    }

    // The producers of today that name no verb: the sweep's plain task and an internal event fact. Ledger (ROAD Opus-1d, 2026-11-14): "a
    // customer line that names no channel" is gone with the `customer` wake source (deleted, owner rule R28).
    const verbless: ReadonlyArray<readonly [string, ReturnType<typeof agentTurnViewOf>]> = [
        ["a plain task's wake", agentTurnViewOf({ source: "internal", context: { taskId: "task-1", subjectId: "task-1" } })],
        [
            "an internal event",
            agentTurnViewOf({ source: "internal", context: { eventName: "knowledge_source.indexed", subjectId: "ks-1" } }),
        ],
    ]

    it.each(verbless)("%s: the flow takes it, routes nothing, runs nothing and tells the founder once", async (_kind, turn) => {
        for (const holds of [true, false]) {
            const subject = await world(holds)

            await expect(subject.flows.takes(turn)).resolves.toBe(true)
            await expect(subject.flows.run(turn)).resolves.toEqual({ status: "skipped", reason: "no_trigger_verb", outcome: null })
            expect(subject.started).toEqual([])
            expect(subject.runs.open).not.toHaveBeenCalled()
            expect(subject.workflows.route).not.toHaveBeenCalled()
            expect(subject.notices.unroutable).toHaveBeenCalledTimes(1)
            expect(subject.notices.unroutable).toHaveBeenCalledWith(turn)
            expect(subject.notices.untaken).not.toHaveBeenCalled()
        }
    })

    it("a customer line that names its channel is routed as before: the verb is the channel's", async () => {
        const subject = await world(true)
        const line = agentTurnViewOf({
            source: "trigger",
            context: { verb: TRIGGER.zaloMessageReceived, eventId: "m-1", conversationId: "conv-1", connectionId: "conn-1" },
        })

        await expect(subject.flows.run(line)).resolves.toEqual({ status: "skipped", reason: "no_workflow", outcome: null })
        expect(subject.workflows.route).toHaveBeenCalledTimes(1)
        expect(subject.notices.unroutable).not.toHaveBeenCalled()
        expect(subject.notices.untaken).toHaveBeenCalledTimes(1)
    })
})

describe("one run in flight per (graph, subject): an event behind its subject's run waits as a held wake (the final rule)", () => {
    /** A second line of the person, as `deliver` wrote it: keyed by its route, taken by the front desk's registration. */
    const lineOf = (attempts = 1): AgentTurnView =>
        agentTurnViewOf({
            agentId: agentOf("chatbot"),
            wakeId: "wake-2",
            source: "trigger",
            scopeKey: "key:routeId=conv-1",
            attempts,
            context: { verb: TRIGGER.zaloMessageReceived, eventId: "zalo:2", conversationId: "conv-1", connectionId: "conn-1", keyPath: "routeId", workflowId: "wf-front" },
        })
    const worldOf = async (inFlight: string | null, ownRun: string | null = null) => {
        const world = workflowWorldOf({ [agentOf("chatbot")]: "chatbot", [agentOf("sales")]: "sales" })
        const { flows, runs } = await build(null, { rows: {}, workflows: world.service })
        runs.inFlightOf.mockResolvedValue(inFlight === null ? null : runViewOf({ id: inFlight }))
        runs.runIdOfWake.mockResolvedValue(ownRun)
        const { threads, started } = threadsOf()
        flows.setThreads(threads)
        return { flows, runs, started }
    }

    it("a line whose route has the front desk's run in flight, that no wait took, is HELD `waiting:<run>`: no second run, nothing pushed in", async () => {
        const { flows, runs, started } = await worldOf("run-7")

        await expect(flows.run(lineOf())).resolves.toEqual({ status: "held", reason: "waiting:run-7", outcome: null })
        expect(started).toEqual([])
        expect(runs.open).not.toHaveBeenCalled()
        expect(runs.inFlightOf).toHaveBeenCalledWith("ws-1", expect.any(String), { kind: "routeId", id: "conv-1" })
    })

    it("a replay of the very wake that opened the run in flight goes on with its run (it is not behind itself)", async () => {
        const { flows, started } = await worldOf("run-7", "run-7")

        await flows.run(lineOf(2))
        expect(started).toHaveLength(1)
    })

    it("with no run in flight for the subject, the line starts the run", async () => {
        const { flows, started } = await worldOf(null)

        await flows.run(lineOf())
        expect(started).toHaveLength(1)
    })

    it("a wake only a `wait` listened to (no registration took it) that no parked run took ends `no_waiter`, never a run or a report", async () => {
        const { flows, started } = await worldOf(null)
        const { workflowId: _taken, ...unregistered } = lineOf().context
        const heard = { ...lineOf(), context: { ...unregistered, waitOnly: "true" as const } }

        await expect(flows.run(heard)).resolves.toMatchObject({ status: "skipped", reason: "no_waiter" })
        expect(started).toEqual([])
    })
})
