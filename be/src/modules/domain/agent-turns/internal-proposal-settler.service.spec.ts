import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { agentTurnViewOf } from "@tests/fixtures/builders/agent-work.builder"
import { AgentTasksService, AgentTurnsService } from "@modules/domain/agent-work"
import { ModuleCatalogService, WorkEngineService } from "@modules/domain/decisions"
import type { ActionEntry, WorkItem } from "@modules/domain/decisions"
import { EventsService } from "@modules/domain/events"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentWriteRightService } from "./agent-write-right.service"
import { AgentTurnsLogEvent } from "./agent-turns.log-events"
import { IntentPipelineService } from "./intent-pipeline.service"
import { IntentTurnService } from "./intent-turn.service"
import { InternalProposalSettlerService } from "./internal-proposal-settler.service"
import type { StoredProposal } from "./agent-turn.policy"
import type {
    IntentPlan,
    IntentRead,
    InternalAction,
    InternalProposal,
    InternalSettleInput,
} from "./agent-turns.contracts"

const input: InternalSettleInput = {
    module: "accounting",
    actorName: "Accountant",
    locale: "vi",
    installationId: "inst-1",
}

const entry = (moduleKey: string): ActionEntry => ({
    action: "send_invoice",
    moduleKey,
    maxMode: null,
    next: [],
    label: { vi: "Send an invoice", en: "Send an invoice" },
})

const action = (over: Partial<InternalAction> = {}): InternalAction => ({
    action: "send_invoice",
    subject: { type: "invoice", id: "inv-1" },
    leadId: "lead-1",
    fields: { amount_vnd: 9_000_000 },
    summary: "Send invoice 1",
    ...over,
})

const proposal = (over: Partial<InternalProposal> = {}): StoredProposal => ({
    text: JSON.stringify(full(over)),
})

const full = (over: Partial<InternalProposal>): InternalProposal => ({
    reply: "On it.",
    tasks: [],
    actions: [],
    needsHuman: false,
    reason: "",
    ...over,
})

const PLAN: IntentPlan = {
    versionId: "v-1",
    trigger: "tag",
    audience: "manager",
    pinned: null,
    contracts: [],
}

const READ: IntentRead = {
    reading: { kind: "safe", cause: "no_intent", detail: "none", intent: null, gap: null, draft: "" },
    trace: {
        versionId: "v-1",
        trigger: "tag",
        audience: "manager",
        offered: [],
        intent: null,
        result: "no_intent",
        detail: "none",
        dropped: [],
    },
}

const DOOR_SETTLED = { reply: "On it.", needsHuman: false, reason: "", tasks: 0, actions: [] }

const item = (id: string): WorkItem => mock<WorkItem>({ id })

const build = async (
    options: {
        readonly live?: boolean
        readonly mayWrite?: boolean
        readonly actions?: Record<string, ActionEntry | null>
        readonly plan?: IntentPlan | null
    } = {},
) => {
    const { live = true, mayWrite = true, actions = { send_invoice: entry("accounting") }, plan = null } = options
    const turns = mock<AgentTurnsService>({ touch: jest.fn(() => Promise.resolve(live)) })
    const tasks = mock<AgentTasksService>({ apply: jest.fn(() => Promise.resolve()) })
    let issued = 0
    const engine = mock<WorkEngineService>({
        runWork: jest.fn(() => {
            issued += 1
            return Promise.resolve(item(`work-${String(issued)}`))
        }),
    })
    const catalog = mock<ModuleCatalogService>({
        actionOf: jest.fn((key: string) => Promise.resolve(actions[key] ?? null)),
    })
    const events = mock<EventsService>({ record: jest.fn(() => Promise.resolve()) })
    const right = mock<AgentWriteRightService>({ mayWrite: jest.fn(() => Promise.resolve(mayWrite)) })
    const logger = mock<Logger>()
    const intents = mock<IntentTurnService>({ planFor: jest.fn().mockResolvedValue(plan) })
    const pipeline = mock<IntentPipelineService>({
        read: jest.fn().mockResolvedValue(READ),
        door: jest.fn().mockResolvedValue({ split: false, settled: DOOR_SETTLED }),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            InternalProposalSettlerService,
            { provide: LOGGER, useValue: logger },
            { provide: AgentTurnsService, useValue: turns },
            { provide: AgentTasksService, useValue: tasks },
            { provide: WorkEngineService, useValue: engine },
            { provide: ModuleCatalogService, useValue: catalog },
            { provide: EventsService, useValue: events },
            { provide: AgentWriteRightService, useValue: right },
            { provide: IntentTurnService, useValue: intents },
            { provide: IntentPipelineService, useValue: pipeline },
        ],
    }).compile()
    return {
        settler: moduleRef.get(InternalProposalSettlerService),
        turns,
        tasks,
        engine,
        catalog,
        events,
        logger,
        right,
        intents,
        pipeline,
    }
}

describe("InternalProposalSettlerService > a stale fence", () => {
    it("writes nothing and requests nothing when the lease has moved on", async () => {
        const { settler, tasks, engine, events } = await build({ live: false })
        const turn = agentTurnViewOf({ source: "tag" })

        const settled = await settler.settle(
            turn,
            proposal({ tasks: [{ op: "add", key: "k" }], actions: [action()] }),
            input,
        )

        expect(settled).toEqual({ kind: "stale" })
        expect(tasks.apply).not.toHaveBeenCalled()
        expect(engine.runWork).not.toHaveBeenCalled()
        expect(events.record).not.toHaveBeenCalled()
    })
})

describe("InternalProposalSettlerService > tasks", () => {
    it("writes the task changes under the agent's own keys and the wake that opened them", async () => {
        const { settler, tasks } = await build()
        const turn = agentTurnViewOf({ source: "tag", wakeId: "wake-5" })
        const when = new Date("2026-11-12T03:00:00Z")

        const settled = await settler.settle(
            turn,
            proposal({
                tasks: [
                    { op: "add", key: "chase-1", title: "Chase 1", nextActionAt: when },
                    { op: "done", key: "old" },
                ],
            }),
            input,
        )

        expect(tasks.apply).toHaveBeenCalledWith("ws-1", "agent-1", [
            { op: "add", key: "chase-1", title: "Chase 1", nextActionAt: when, originWakeId: "wake-5" },
            { op: "done", key: "old", originWakeId: "wake-5" },
        ])
        expect(settled).toMatchObject({ kind: "settled", tasks: 2, actions: [] })
    })
})

describe("InternalProposalSettlerService > actions", () => {
    it("sends an action to the engine as the agent's request, with the dedupe key of the wake and the origin, and no model call", async () => {
        const { settler, engine } = await build()
        const turn = agentTurnViewOf({ source: "tag", wakeId: "wake-5", turnId: "turn-5" })

        const settled = await settler.settle(turn, proposal({ actions: [action()] }), input)

        expect(engine.runWork).toHaveBeenCalledWith(
            { workspaceId: "ws-1", actor: "Accountant", locale: "vi" },
            {
                action: "send_invoice",
                subject_type: "invoice",
                subject_id: "inv-1",
                lead_id: "lead-1",
                dedupeKey: "agentturn:wake-5:0",
                preset: true,
                forceAsk: undefined,
                installationId: "inst-1",
                seed: { summary: "Send invoice 1", fields: { amount_vnd: 9_000_000 } },
                origin: { turnId: "turn-5", wakeId: "wake-5" },
            },
        )
        expect(settled).toEqual({
            kind: "settled",
            reply: "On it.",
            needsHuman: false,
            reason: "",
            tasks: 0,
            actions: [{ index: 0, action: "send_invoice", outcome: "requested", workItemId: "work-1" }],
        })
    })

    it("never reads the amount the model stated: it stays a field of the request", async () => {
        const { settler, engine } = await build()

        await settler.settle(agentTurnViewOf({ source: "tag" }), proposal({ actions: [action()] }), input)

        const spec = engine.runWork.mock.calls[0]?.[1]
        expect(spec?.seed).not.toHaveProperty("amount_vnd")
        expect(spec?.seed?.fields).toEqual({ amount_vnd: 9_000_000 })
    })

    it.each(["internal", "schedule"] as const)("makes a %s turn always ask a person", async (source) => {
        const { settler, engine } = await build({ mayWrite: false })

        await settler.settle(agentTurnViewOf({ source }), proposal({ actions: [action()] }), input)

        expect(engine.runWork.mock.calls[0]?.[1].forceAsk).toBe("over_authority")
    })
})

describe("InternalProposalSettlerService > actions of a turn whose person may not write", () => {
    it("makes a tag whose author may not write ask a person, judged by the author of the wake", async () => {
        const { settler, engine, right } = await build({ mayWrite: false })
        const turn = agentTurnViewOf({ source: "tag", context: { authorUserId: "user-9" } })

        await settler.settle(turn, proposal({ actions: [action()] }), input)

        expect(right.mayWrite).toHaveBeenCalledWith("tag", "user-9", "ws-1")
        expect(engine.runWork.mock.calls[0]?.[1].forceAsk).toBe("over_authority")
    })

    it("asks when the wake has no author on record", async () => {
        const { settler, right } = await build({ mayWrite: false })

        await settler.settle(agentTurnViewOf({ source: "tag", context: {} }), proposal({ actions: [action()] }), input)

        expect(right.mayWrite).toHaveBeenCalledWith("tag", null, "ws-1")
    })

    it("keys each action by its place in the proposal", async () => {
        const { settler, engine } = await build()

        await settler.settle(
            agentTurnViewOf({ source: "tag", wakeId: "wake-5" }),
            proposal({ actions: [action(), action({ summary: "second" })] }),
            input,
        )

        expect(engine.runWork.mock.calls.map(([, spec]) => spec.dedupeKey)).toEqual([
            "agentturn:wake-5:0",
            "agentturn:wake-5:1",
        ])
    })
})

describe("InternalProposalSettlerService > the shape of a request", () => {
    it("sends an action with no subject as a request about the customer, or about an input when there is none", async () => {
        const { settler, engine } = await build()
        const { subject: _subject, ...bare } = action()

        await settler.settle(
            agentTurnViewOf({ source: "tag" }),
            proposal({ actions: [bare, { ...bare, leadId: null }] }),
            input,
        )

        expect(engine.runWork.mock.calls.map(([, spec]) => [spec.subject_type, spec.subject_id, spec.lead_id])).toEqual(
            [
                ["lead", null, "lead-1"],
                ["inbound", null, null],
            ],
        )
    })
})

describe("InternalProposalSettlerService > actions that never reach the engine", () => {
    it("drops an action the registry does not know, audits it, and goes on to the next", async () => {
        const { settler, engine, events, logger } = await build()
        const turn = agentTurnViewOf({ source: "tag", wakeId: "wake-5" })

        const settled = await settler.settle(
            turn,
            proposal({ actions: [action({ action: "launch_rocket" }), action()] }),
            input,
        )

        expect(settled).toMatchObject({
            actions: [
                { index: 0, action: "launch_rocket", outcome: "dropped", reason: "unknown_action" },
                { index: 1, action: "send_invoice", outcome: "requested" },
            ],
        })
        expect(engine.runWork).toHaveBeenCalledTimes(1)
        expect(events.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "agent.action_dropped",
            actor: "Accountant",
            summary: "Action launch_rocket was dropped: unknown_action",
            evidence: "agentturn:wake-5:0",
        })
        expect(logger.warn).toHaveBeenCalledWith(AgentTurnsLogEvent.ActionDropped, {
            agentId: "agent-1",
            wakeId: "wake-5",
            index: 0,
            reason: "unknown_action",
        })
    })

    it("drops an action that belongs to another module than the agent's", async () => {
        const { settler, engine, events } = await build({ actions: { send_invoice: entry("sales") } })

        const settled = await settler.settle(
            agentTurnViewOf({ source: "tag" }),
            proposal({ actions: [action()] }),
            input,
        )

        expect(settled).toMatchObject({ actions: [{ outcome: "dropped", reason: "outside_module" }] })
        expect(engine.runWork).not.toHaveBeenCalled()
        expect(events.record).toHaveBeenCalledTimes(1)
    })

    it("lets a refusal of the engine reach the drain, which retries from the stored proposal", async () => {
        const { settler, engine } = await build()
        const cause = new Error("engine down")
        engine.runWork.mockRejectedValue(cause)

        await expect(
            settler.settle(agentTurnViewOf({ source: "tag" }), proposal({ actions: [action()] }), input),
        ).rejects.toBe(cause)
    })

    it("hands the reply and the wish for a person back for the handler to deliver", async () => {
        const { settler } = await build()

        const settled = await settler.settle(
            agentTurnViewOf({ source: "tag" }),
            proposal({ reply: "Please look", needsHuman: true, reason: "Large amount" }),
            input,
        )

        expect(settled).toEqual({
            kind: "settled",
            reply: "Please look",
            needsHuman: true,
            reason: "Large amount",
            tasks: 0,
            actions: [],
        })
    })
})

describe("InternalProposalSettlerService > a wake named by its ids", () => {
    const wake = {
        workspaceId: "ws-1",
        agentId: "agent-1",
        wakeId: "wake-1",
        turnId: "turn-1",
        source: "tag",
        authorUserId: "user-1",
    } as const

    it("applies the text of a proposal for a wake without asking for its lease, so a step can settle from its row", async () => {
        const { settler, tasks, engine, right } = await build()

        const settled = await settler.apply(wake, proposal({ actions: [action()] }).text, input)

        expect(settled).toMatchObject({ kind: "settled", reply: "On it.", actions: [{ outcome: "requested" }] })
        expect(tasks.apply).toHaveBeenCalledWith("ws-1", "agent-1", [])
        expect(right.mayWrite).toHaveBeenCalledWith("tag", "user-1", "ws-1")
        expect(engine.runWork).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                dedupeKey: "agentturn:wake-1:0",
                origin: { turnId: "turn-1", wakeId: "wake-1" },
            }),
        )
    })

    it("reads a text that is no proposal as a plain reply", async () => {
        const { settler, engine } = await build()

        await expect(settler.apply(wake, "Just a line.", input)).resolves.toMatchObject({
            reply: "Just a line.",
            actions: [],
        })
        expect(engine.runWork).not.toHaveBeenCalled()
    })

    it("says whether the worker still holds the lease of the turn", async () => {
        const live = await build({ live: true })
        const lost = await build({ live: false })
        const turn = agentTurnViewOf({})

        await expect(live.settler.live(turn)).resolves.toBe(true)
        await expect(lost.settler.live(turn)).resolves.toBe(false)
    })
})

describe("InternalProposalSettlerService > a turn on the contract pipeline", () => {
    const SIGNAL = new AbortController().signal

    it("keeps the text on the run, reads it and runs the tag door with the settle input, and answers what the door applied with the trace", async () => {
        const { settler, pipeline, intents, tasks } = await build({ plan: PLAN })
        const turn = agentTurnViewOf({ source: "tag", context: { authorUserId: "user-1", intent: "pay" } })

        const settled = await settler.settle(turn, { text: "envelope" }, input, SIGNAL)

        expect(settled).toEqual({ kind: "settled", ...DOOR_SETTLED, traced: { intent: READ.trace } })
        expect(intents.planFor).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            agentId: "agent-1",
            source: "tag",
            authorUserId: "user-1",
            pinned: "pay",
        })
        expect(pipeline.read).toHaveBeenCalledWith(turn, PLAN, "envelope", SIGNAL)
        expect(pipeline.door).toHaveBeenCalledWith(turn, "tag_door", READ, SIGNAL, { settle: input })
        expect(tasks.apply).not.toHaveBeenCalled()
    })

    it("settles nothing when the door split the turn", async () => {
        const { settler, pipeline } = await build({ plan: PLAN })
        pipeline.door.mockResolvedValue({ split: true, fired: true })

        await expect(settler.settle(agentTurnViewOf({ source: "tag" }), {}, input)).resolves.toEqual({
            kind: "settled",
            reply: "",
            needsHuman: false,
            reason: "",
            tasks: 0,
            actions: [],
            traced: { intent: READ.trace },
        })
    })

    it("settles nothing when the door answers what no door answers", async () => {
        const { settler, pipeline } = await build({ plan: PLAN })
        pipeline.door.mockResolvedValue({ junk: true })

        await expect(settler.settle(agentTurnViewOf({ source: "tag" }), {}, input)).resolves.toMatchObject({
            kind: "settled",
            actions: [],
        })
    })

    it("reads a turn the graph holds no contracts for as it always did, with no run", async () => {
        const { settler, pipeline } = await build()

        await expect(settler.settle(agentTurnViewOf({ source: "tag" }), proposal(), input)).resolves.toMatchObject({
            kind: "settled",
            reply: "On it.",
        })
        expect(pipeline.read).not.toHaveBeenCalled()
    })
})
