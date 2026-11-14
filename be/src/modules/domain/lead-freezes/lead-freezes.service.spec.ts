import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { AgentGraphFreezeGateService } from "@modules/domain/agent-graphs"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { agentTurnViewOf } from "@tests/fixtures/builders/agent-work.builder"
import { frozenFreezeOf, releasedFreezeOf } from "@tests/fixtures/builders/lead-freezes.builder"
import { LeadFreezesError, LeadFreezesErrorCode } from "./errors/lead-freezes.error"
import { LeadFreezeRecordsService } from "./lead-freeze-records.service"
import type { FreezeBuild } from "./lead-freeze-records.service"
import { LeadFreezeStopHoldsService } from "./lead-freeze-stop-holds.service"
import { LeadFreezesLogEvent } from "./lead-freezes.log-events"
import { LeadFreezesService } from "./lead-freezes.service"
import type { FreezeSubject, HeldStop, LeadFreeze } from "./lead-freezes.contracts"

/** The hold of thread run run-1's stop at `claim-ack`, about lead-1. */
const holdOf = (overrides: Partial<LeadFreeze> = {}): LeadFreeze =>
    frozenFreezeOf({ frozenReason: "run_stop", workItemId: null, ...overrides })

/** The records of the freezes in memory, read and written the way the engine does it. */
const memoryOf = (records: Map<string, LeadFreeze>) => {
    const find = (match: (freeze: LeadFreeze) => boolean): LeadFreeze | null =>
        [...records.values()].find(match) ?? null
    return {
        byKey: (_ws: string, key: string) => Promise.resolve(find((each) => each.key === key)),
        byId: (_ws: string, id: string) => Promise.resolve(records.get(id) ?? null),
        byContact: (_ws: string, contactId: string) => Promise.resolve(find((each) => each.contactId === contactId)),
        byRun: (_ws: string, runId: string) => Promise.resolve(find((each) => each.frozenRunId === runId)),
        holding: () => Promise.resolve([...records.values()].filter((each) => each.status !== "released")),
        patch: (_ws: string, id: string, update: FreezeBuild) => {
            const freeze = records.get(id)
            if (freeze === undefined)
                return Promise.reject(new LeadFreezesError({ code: LeadFreezesErrorCode.NotFound }))
            const values = update(freeze)
            if (values === null) return Promise.resolve(null)
            const next = { ...freeze, ...values, version: String(Number(freeze.version) + 1) }
            records.set(id, next)
            return Promise.resolve(next)
        },
    }
}

const build = async (...initial: ReadonlyArray<LeadFreeze>) => {
    const records = new Map<string, LeadFreeze>(initial.map((freeze) => [freeze.id, freeze]))
    const memory = memoryOf(records)
    const store = mock<LeadFreezeRecordsService>({
        byKey: jest.fn(memory.byKey),
        byId: jest.fn(memory.byId),
        byContact: jest.fn(memory.byContact),
        byRun: jest.fn(memory.byRun),
        holding: jest.fn(memory.holding),
        patch: jest.fn(memory.patch),
        contactOfConversation: jest.fn().mockResolvedValue(null),
        aliasesOf: jest.fn((_ws: string, contactId: string) => Promise.resolve([contactId])),
    })
    const openStops: Array<HeldStop> = []
    const stopHolds = mock<LeadFreezeStopHoldsService>({
        isOwnRun: jest.fn().mockResolvedValue(false),
        holdFor: jest.fn().mockResolvedValue(false),
        holding: jest.fn().mockResolvedValue(null),
        openAbout: jest.fn((_ws: string, subject: FreezeSubject) =>
            Promise.resolve(openStops.filter((stop) => stop.contactId === subject.contactId)),
        ),
        settle: jest.fn().mockResolvedValue("on_stop"),
    })
    const gate = mock<AgentGraphFreezeGateService>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadFreezesService,
            { provide: CLOCK, useValue: new FakeClock("2026-11-04T10:05:00.000Z") },
            { provide: LOGGER, useValue: logger },
            { provide: AgentGraphFreezeGateService, useValue: gate },
            { provide: LeadFreezeRecordsService, useValue: store },
            { provide: LeadFreezeStopHoldsService, useValue: stopHolds },
        ],
    }).compile()
    return { service: moduleRef.get(LeadFreezesService), records, store, stopHolds, openStops, gate, logger }
}

const CHAT_TURN = agentTurnViewOf({
    wakeId: "wake-9",
    agentId: "chatbot",
    source: "trigger",
    context: { conversationId: "c-1" },
})

describe("LeadFreezesService registration", () => {
    it("registers with the gate of the graph flows once the app has started", async () => {
        const { service, gate } = await build()
        service.onModuleInit()
        expect(gate.set).toHaveBeenCalledWith(service)
    })
})

describe("LeadFreezesService.hold: a new wake of a customer whose thread run waits at a stop", () => {
    it("admits a wake whose customer is not held, and asks the stop holds for the first hold", async () => {
        const { service, stopHolds } = await build(releasedFreezeOf())
        await expect(service.hold(CHAT_TURN, { contactId: "lead-1", conversationId: "c-1" })).resolves.toBe(false)
        await expect(service.hold(CHAT_TURN, {})).resolves.toBe(false)
        expect(stopHolds.holdFor).toHaveBeenCalledTimes(1)
        expect(stopHolds.holdFor).toHaveBeenCalledWith(
            CHAT_TURN,
            { contactId: "lead-1", conversationId: "c-1" },
            expect.objectContaining({ key: "contact:lead-1", contactId: "lead-1" }),
        )
    })

    it("holds a line of the held lead and records it as a pending event, once per wake, then settles the hold", async () => {
        const { service, records, logger, stopHolds } = await build(holdOf())
        const trigger = { contactId: "lead-1", conversationId: "c-1", messageIds: ["m-9"], subject: { channel: "zalo", id: "u-1" } }

        await expect(service.hold(CHAT_TURN, trigger)).resolves.toBe(true)
        await expect(service.hold(CHAT_TURN, trigger)).resolves.toBe(true)

        expect(records.get("freeze-1")?.pending).toEqual([
            expect.objectContaining({ wakeId: "wake-9", kind: "message", conversationId: "c-1", messageIds: ["m-9"] }),
        ])
        expect(logger.info).toHaveBeenCalledWith(
            LeadFreezesLogEvent.EventHeld,
            expect.objectContaining({ wakeId: "wake-9" }),
        )
        expect(stopHolds.settle).toHaveBeenCalledWith("ws-1", expect.objectContaining({ id: "freeze-1" }))
    })

    it("never holds the wake that opened the stopped run, tried again", async () => {
        const { service, stopHolds, records } = await build(holdOf())
        stopHolds.isOwnRun.mockResolvedValue(true)
        await expect(service.hold(CHAT_TURN, { contactId: "lead-1" })).resolves.toBe(false)
        expect(records.get("freeze-1")?.pending).toEqual([])
    })

    it("finds the lead through the conversation when the wake names only the conversation", async () => {
        const { service, store } = await build(holdOf())
        store.contactOfConversation.mockResolvedValue("lead-1")
        await expect(service.hold(CHAT_TURN, { conversationId: "c-7" })).resolves.toBe(true)
    })

})

describe("LeadFreezesService.hold: other workflows and the old engine's freezes", () => {
    it("holds a wake of the held workflow only: a wake of another workflow of the same customer starts its run", async () => {
        const { service, records } = await build(holdOf({ key: "contact:lead-1|wf:wf-consult" }))
        const ofWorkflow = (workflowId: string) => ({ contactId: "lead-1", conversationId: "c-1", workflowId })

        await expect(service.hold(CHAT_TURN, ofWorkflow("wf-front-desk"))).resolves.toBe(false)
        expect(records.get("freeze-1")?.pending).toEqual([])

        await expect(service.hold(CHAT_TURN, ofWorkflow("wf-consult"))).resolves.toBe(true)
        expect(records.get("freeze-1")?.pending).toEqual([expect.objectContaining({ wakeId: "wake-9" })])
    })

    it("lets a freeze of the old engine hold nobody: the wake goes to the stop holds, and the old record is left as it was", async () => {
        const old = frozenFreezeOf()
        const { service, records, stopHolds } = await build(old)
        const tag = agentTurnViewOf({ wakeId: "wake-tx", agentId: "accounting", source: "tag", context: {} })

        await expect(service.hold(CHAT_TURN, { contactId: "lead-1", conversationId: "c-1" })).resolves.toBe(false)
        await expect(service.hold(tag, { subject: "bank-transaction:tx-1" })).resolves.toBe(false)

        expect(stopHolds.holdFor).toHaveBeenCalledTimes(1)
        expect(records.get("freeze-1")).toEqual(old)
    })
})

describe("LeadFreezesService.frozen and waitingOf: what the engine asks without recording anything", () => {
    it("says whether the workflow a trigger names is held for its customer, and records no event", async () => {
        const { service, records, store, stopHolds } = await build(holdOf({ key: "contact:lead-1|wf:wf-consult" }))
        const ofWorkflow = (workflowId: string) => ({ contactId: "lead-1", conversationId: "c-1", workflowId })

        await expect(service.frozen("ws-1", ofWorkflow("wf-consult"))).resolves.toBe(true)
        await expect(service.frozen("ws-1", ofWorkflow("wf-front-desk"))).resolves.toBe(false)
        await expect(service.frozen("ws-1", {})).resolves.toBe(false)
        stopHolds.holding.mockResolvedValueOnce({
            runId: "run-2",
            stepKey: "consult",
            agentId: "chatbot",
            workflowId: "wf-front-desk",
            contactId: "lead-1",
            conversationId: "c-1",
            toldConversationIds: [],
            stoppedAt: "2026-11-04T10:01:00.000Z",
        })
        await expect(service.frozen("ws-1", ofWorkflow("wf-front-desk"))).resolves.toBe(true)

        expect(records.get("freeze-1")?.pending).toEqual([])
        expect(store.patch).not.toHaveBeenCalled()
    })

    it("lists what waits for the founder for the customer of a trigger: the holds, and the open stops not held yet", async () => {
        const { service, records, openStops } = await build(holdOf({ key: "contact:lead-1|wf:wf-consult" }))
        records.set("freeze-2", holdOf({ id: "freeze-2", key: "contact:lead-2|wf:wf-consult", contactId: "lead-2" }))
        records.set(
            "freeze-3",
            frozenFreezeOf({ id: "freeze-3", key: "contact:lead-1|wf:wf-old", frozenRunId: "run-old" }),
        )
        openStops.push(
            {
                runId: "run-1",
                stepKey: "claim-ack",
                agentId: "a",
                workflowId: "wf-consult",
                contactId: "lead-1",
                conversationId: "c-1",
                toldConversationIds: [],
                stoppedAt: "x",
            },
            {
                runId: "run-5",
                stepKey: "match",
                agentId: "a",
                workflowId: "wf-reconcile",
                contactId: "lead-1",
                conversationId: null,
                toldConversationIds: [],
                stoppedAt: "2026-11-04T10:02:00.000Z",
            },
        )

        await expect(
            service.waitingOf("ws-1", { contactId: "lead-1", conversationId: "c-1", workflowId: "wf-front-desk" }),
        ).resolves.toEqual([
            { step: "Take a payment claim", since: "2026-11-04T10:00:00.000Z" },
            { step: "match", since: "2026-11-04T10:02:00.000Z" },
        ])
        await expect(service.waitingOf("ws-1", { contactId: "lead-3" })).resolves.toEqual([])
        await expect(service.waitingOf("ws-1", {})).resolves.toEqual([])
    })
})

describe("LeadFreezesService state, for the pages", () => {
    it("answers a hold whose stop is open, and null for one whose stop closed, a released one or an old freeze", async () => {
        const { service, stopHolds, records } = await build(
            holdOf(),
            frozenFreezeOf({ id: "freeze-old", contactId: "lead-9", frozenRunId: "run-9" }),
        )

        await expect(service.stateOfContact("ws-1", "lead-1")).resolves.toMatchObject({
            id: "freeze-1",
            onStop: true,
            workItemId: null,
        })
        await expect(service.stateOfRun("ws-1", "run-1")).resolves.toMatchObject({ id: "freeze-1" })
        await expect(service.stateOf("ws-1", "freeze-old")).resolves.toBeNull()
        await expect(service.stateOfContact("ws-1", "lead-9")).resolves.toBeNull()

        stopHolds.settle.mockImplementationOnce((_ws: string, freeze: LeadFreeze) => {
            records.set(freeze.id, { ...freeze, status: "released" })
            return Promise.resolve("released")
        })
        await expect(service.stateOf("ws-1", "freeze-1")).resolves.toBeNull()
        await expect(service.stateOf("ws-1", "freeze-404")).resolves.toBeNull()
    })
})
