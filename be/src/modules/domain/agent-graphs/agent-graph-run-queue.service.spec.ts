import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import { AgentRunsService, type RunView } from "@modules/domain/agent-runs"
import type { AgentWakeContext, PendingScopeWake } from "@modules/domain/agent-work"
import { DeliveredWakesService } from "@modules/domain/provider-triggers/delivered-wakes.service"
import { NODE_EFFECT_STORE, type NodeEffectStore, type NodeTurn, type StoredEffect } from "@modules/domain/graph-nodes"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentGraphRawRowsService } from "./agent-graph-raw-rows.service"
import { AgentGraphRunQueueService } from "./agent-graph-run-queue.service"

/** A row as the ledger writes it once. */
type EffectInsert = Parameters<NodeEffectStore["insert"]>[1]

const SCOPE = "key:routeId=route-1"

/** A line of the person on the run's key, as `deliver` wrote its wake (ids only). */
const lineWake = (id: string, at: string, workflowId = "wf-front"): PendingScopeWake => {
    const context: AgentWakeContext = {
        verb: TRIGGER.zaloMessageReceived,
        eventId: `m-${id}`,
        declaration: "zalo_oa:message.received",
        workflowId,
        keyPath: "routeId",
        connectionId: "conn-zalo",
        contactId: "contact-1",
        conversationId: "route-1",
        rawType: "zalo_oa.event",
        rawRowId: `row-${id}`,
    }
    return { id, context, createdAt: new Date(at) }
}

/** The effect ledger: one row per key, written once (insert-or-nothing), as the table's unique key makes it. */
const memoryLedger = (): NodeEffectStore & { readonly rows: Map<string, StoredEffect> } => {
    const rows = new Map<string, StoredEffect>()
    return {
        rows,
        byKey: (_ws, key) => Promise.resolve(rows.get(key) ?? null),
        ofStep: () => Promise.resolve([]),
        resettle: () => Promise.resolve(false),
        insert: (_ws, effect: EffectInsert) => {
            if (rows.has(effect.effectKey)) return Promise.resolve(false)
            rows.set(effect.effectKey, { ...effect, undoneAt: null, createdAt: "2026-11-14T03:00:00.000Z" })
            return Promise.resolve(true)
        },
    }
}

const build = async (pendingAtFirst: ReadonlyArray<PendingScopeWake>, heldAtFirst: ReadonlyArray<PendingScopeWake> = []) => {
    let pending = [...pendingAtFirst]
    // The wakes held behind the run (`waiting:run-1`, rule Q-1), oldest first, as the table keeps them.
    let heldBehind = [...heldAtFirst]
    let waitingNow = 0
    const claimed: Array<ReadonlyArray<string>> = []
    const wakes = mock<DeliveredWakesService>()
    wakes.pendingOfScope.mockImplementation((_m, _ws, agentId, scopeKey) =>
        Promise.resolve(agentId === "front" && scopeKey === SCOPE ? pending : []),
    )
    wakes.claimQueued.mockImplementation((_m, _ws, ids) => {
        claimed.push(ids)
        const before = pending.length + heldBehind.length
        pending = pending.filter((wake) => !ids.includes(wake.id))
        heldBehind = heldBehind.filter((wake) => !ids.includes(wake.id))
        return Promise.resolve(before - pending.length - heldBehind.length)
    })
    wakes.heldBehind.mockImplementation((_m, _ws, runId) => Promise.resolve(runId === "run-1" ? heldBehind : []))
    wakes.waitingCountOf.mockImplementation(() => Promise.resolve(waitingNow))
    const runs = mock<AgentRunsService>()
    runs.runOf.mockResolvedValue(
        mock<RunView>({ id: "run-1", agentId: "front", status: "running", context: { threadScope: SCOPE, workflowId: "wf-front" } }),
    )
    const raw = mock<AgentGraphRawRowsService>()
    raw.pipelineEventOf.mockImplementation((wake) => Promise.resolve({ data: { text: `words of ${String(wake.context.rawRowId)}` } }))
    const ledger = memoryLedger()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphRunQueueService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: mockEntityManager() },
            { provide: AgentRunsService, useValue: runs },
            { provide: DeliveredWakesService, useValue: wakes },
            { provide: NODE_EFFECT_STORE, useValue: ledger },
            { provide: AgentGraphRawRowsService, useValue: raw },
        ],
    }).compile()
    return {
        queue: moduleRef.get(AgentGraphRunQueueService),
        claimed,
        ledger,
        held: () => heldBehind,
        holdBehind: (wake: PendingScopeWake) => {
            heldBehind = [...heldBehind, wake]
        },
        arrive: (wake: PendingScopeWake) => {
            pending = [...pending, wake]
        },
        pending: () => pending,
        waitBehind: (count: number) => {
            waitingNow = count
        },
    }
}

/** The turn of a step visit: `answers` founder answers so far (0 on the first run of the step). */
const turnOf = (answers = 0): NodeTurn =>
    mock<NodeTurn>({
        workspaceId: "ws-1",
        founderAnswers: Array.from({ length: answers }, (_, at) => ({ text: `answer ${at}`, at: "2026-11-14T03:10:00.000Z" })),
    })

const PLACE = { runId: "run-1", stepKey: "answer" }

describe("AgentGraphRunQueueService: the run queue (D5, ROAD-API section 4)", () => {
    it("settle time: the first line started the run, and its first step's snapshot holds the two later lines, in order", async () => {
        const world = await build([lineWake("w2", "2026-11-14T03:00:02Z"), lineWake("w3", "2026-11-14T03:00:04Z")])

        const snapshot = await world.queue.snapshotOf(turnOf(), { runId: "run-1", stepKey: "hear" })

        expect(snapshot.map((event) => event.eventId)).toEqual(["m-w2", "m-w3"])
        expect(snapshot[0]).toEqual({
            verb: TRIGGER.zaloMessageReceived,
            at: "2026-11-14T03:00:02.000Z",
            eventId: "m-w2",
            accountId: "conn-zalo",
            contactId: "contact-1",
            routeId: "route-1",
            data: { text: "words of row-w2" },
        })
        // Taken: the drain starts no run for them.
        expect(world.claimed).toEqual([["w2", "w3"]])
        expect(world.pending()).toEqual([])
    })

    it("a re-run of the same step visit reads the SAME snapshot and takes nothing new; a later event stays queued for the next run", async () => {
        const world = await build([lineWake("w2", "2026-11-14T03:00:02Z")])
        const first = await world.queue.snapshotOf(turnOf(), PLACE)
        world.arrive(lineWake("w4", "2026-11-14T03:01:00Z"))

        const replay = await world.queue.snapshotOf(turnOf(), PLACE)

        expect(replay).toEqual(first)
        expect(world.claimed.flat()).not.toContain("w4")
        // What no step took is still pending: when the run's turn ends, the drain starts the next run of the key with it.
        expect(world.pending().map((wake) => wake.id)).toEqual(["w4"])
        // One snapshot row for the visit (beside the run's one first-visit mark `queue:<run>`).
        expect([...world.ledger.rows.keys()].filter((key) => key.startsWith("queue:run-1:"))).toEqual(["queue:run-1:answer:0"])
        expect(world.ledger.rows.has("queue:run-1")).toBe(true)
    })

    it("a step visit after the founder's answer keeps what the step took before and adds what came during the stop", async () => {
        const world = await build([lineWake("w2", "2026-11-14T03:00:02Z")])
        await world.queue.snapshotOf(turnOf(0), PLACE)
        world.holdBehind(lineWake("w5", "2026-11-14T03:00:30Z"))

        const after = await world.queue.snapshotOf(turnOf(1), PLACE, true)

        // Rule Q-1: the event held behind the run (`waiting:run-1`) joins the visit's queue, after what the step took before.
        expect(after.map((event) => event.eventId)).toEqual(["m-w2", "m-w5"])
        expect(after[1]).toMatchObject({ verb: TRIGGER.zaloMessageReceived, routeId: "route-1", contactId: "contact-1", data: { text: "words of row-w5" } })
        // The held wake is closed `queued:<run>` (no drain starts a run for it).
        expect(world.claimed.at(-1)).toEqual(["w2", "w5"])
        expect(world.held()).toEqual([])
    })

    it("takes only events of the run's own workflow: another workflow's event on the same key starts its own run", async () => {
        const world = await build([lineWake("w2", "2026-11-14T03:00:02Z", "wf-other"), lineWake("w3", "2026-11-14T03:00:03Z")])

        const snapshot = await world.queue.snapshotOf(turnOf(), PLACE)

        expect(snapshot.map((event) => event.eventId)).toEqual(["m-w3"])
        expect(world.pending().map((wake) => wake.id)).toEqual(["w2"])
    })

    it("outside a run there is no queue", async () => {
        const world = await build([lineWake("w2", "2026-11-14T03:00:02Z")])

        await expect(world.queue.snapshotOf(turnOf(), null)).resolves.toEqual([])
        expect(world.claimed).toEqual([])
    })

    it("only the run's FIRST step visit takes the waiting list: a later step takes no pending wake, so nothing is pushed into a started run", async () => {
        const world = await build([lineWake("w2", "2026-11-14T03:00:02Z")])
        await world.queue.snapshotOf(turnOf(), { runId: "run-1", stepKey: "hear" })
        world.arrive(lineWake("w4", "2026-11-14T03:01:00Z"))

        const later = await world.queue.snapshotOf(turnOf(), { runId: "run-1", stepKey: "answer" })

        expect(later).toEqual([])
        expect(world.pending().map((wake) => wake.id)).toEqual(["w4"])
    })

    it("R18: a later step's visit after the founder's answer takes the events held behind the stop (the stopped run takes them on resume)", async () => {
        const world = await build([])
        await world.queue.snapshotOf(turnOf(), { runId: "run-1", stepKey: "hear" })
        world.holdBehind(lineWake("w6", "2026-11-14T03:00:40Z"))

        const resumed = await world.queue.snapshotOf(turnOf(1), PLACE, true)

        expect(resumed.map((event) => event.eventId)).toEqual(["m-w6"])
        expect(world.claimed.at(-1)).toEqual(["w6"])
        expect(world.held()).toEqual([])
    })

    it("rule Q-1: the FIRST visit of a step (no decision yet) takes no held wake: it stays held behind the run", async () => {
        const world = await build([], [lineWake("w7", "2026-11-14T03:00:50Z")])

        const first = await world.queue.snapshotOf(turnOf(0), { runId: "run-1", stepKey: "hear" })

        expect(first).toEqual([])
        expect(world.held().map((wake) => wake.id)).toEqual(["w7"])
    })

    it("`run.waiting` is fixed per step attempt: a re-run of the visit reads the same count, the next attempt counts again", async () => {
        const world = await build([])
        world.waitBehind(3)
        await expect(world.queue.waitingOf(turnOf(), PLACE)).resolves.toBe(3)
        world.waitBehind(5)

        await expect(world.queue.waitingOf(turnOf(), PLACE)).resolves.toBe(3)
        await expect(world.queue.waitingOf(turnOf(1), PLACE)).resolves.toBe(5)
        await expect(world.queue.waitingOf(turnOf(), null)).resolves.toBe(0)
    })
})
