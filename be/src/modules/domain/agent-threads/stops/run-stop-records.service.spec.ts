import { Test } from "@nestjs/testing"
import { MemoryRunStopStore } from "@tests/fixtures/builders/engine-core-stores.builder"
import { RunStopEntity } from "../persistence/entities"
import { RunStopsErrorCode } from "./errors/run-stops.error"
import { RunStopRecordsService } from "./run-stop-records.service"
import { RUN_STOP_STORE } from "./run-stop-store.port"
import { runStopOfRow } from "./run-stop-store.typeorm"
import type { RunStop, StopOpen } from "./run-stop.contracts"

const NOW = "2026-11-10T10:00:00.000Z"
const LATER = "2026-11-10T11:00:00.000Z"

const STOP: RunStop = {
    id: "stop-1",
    version: "1",
    runId: "11111111-1111-4111-8111-111111111111",
    stepKey: "match",
    agentId: "22222222-2222-4222-8222-222222222222",
    workflowId: null,
    contactId: null,
    conversationId: null,
    kind: "ai_report",
    state: "open",
    reason: "why",
    question: null,
    detail: { suggestions: [], facts: [{ name: "amount", value: "1.000\u0111" }] },
    cardMessageId: null,
    customerLines: [],
    answers: [],
    decision: null,
    repeats: 1,
    stoppedAt: NOW,
    resolvedAt: null,
}

/** A row of the stops table as Postgres hands it back, with the members a case sets. */
const rowOf = (values: Partial<Record<keyof RunStopEntity, unknown>> = {}): RunStopEntity =>
    Object.assign(new RunStopEntity(), {
        id: "stop-1",
        workspaceId: "ws-1",
        runId: STOP.runId,
        stepKey: "match",
        agentId: STOP.agentId,
        workflowId: null,
        contactId: null,
        conversationId: null,
        kind: "ai_report",
        state: "open",
        reason: "why",
        question: null,
        detail: STOP.detail,
        cardMessageId: null,
        customerLines: { lines: [] },
        answers: { answers: [] },
        decision: null,
        repeats: 1,
        stoppedAt: new Date(NOW),
        resolvedAt: null,
        version: 1,
        createdAt: new Date(NOW),
        updatedAt: new Date(NOW),
        ...values,
    })

const DATA = STOP

const OPEN: StopOpen = {
    workspaceId: "ws-1",
    runId: DATA.runId,
    stepKey: "match",
    agentId: DATA.agentId,
    workflowId: null,
    contactId: null,
    conversationId: null,
    kind: "ai_error",
    reason: "AI l\u1ed7i",
    question: null,
    suggestions: [],
    facts: [],
    card: {
        locale: "vi",
        workflow: { moduleKey: "accounting", key: "reconcile", title: "" },
        step: { key: "match", nodeId: "accounting.match-payment", title: "" },
        by: "engine",
    },
}

const build = async (rows: ReadonlyArray<RunStop> = []) => {
    const store = new MemoryRunStopStore(rows)
    const moduleRef = await Test.createTestingModule({
        providers: [RunStopRecordsService, { provide: RUN_STOP_STORE, useValue: store }],
    }).compile()
    return { records: moduleRef.get(RunStopRecordsService), store }
}

describe("runStopOfRow", () => {
    it("reads a stop, its lists unwrapped", () => {
        expect(runStopOfRow(rowOf())).toMatchObject({
            id: "stop-1",
            runId: DATA.runId,
            kind: "ai_report",
            state: "open",
            detail: { facts: [{ name: "amount", value: "1.000\u0111" }] },
            customerLines: [],
            answers: [],
            decision: null,
        })
    })

    it("refuses a row that is not the shape of a stop", () => {
        expect(() => runStopOfRow(rowOf({ kind: "mystery" }))).toThrow(
            expect.objectContaining({ code: RunStopsErrorCode.RecordUnreadable }),
        )
        expect(() => runStopOfRow(rowOf({ answers: [] }))).toThrow(
            expect.objectContaining({ code: RunStopsErrorCode.RecordUnreadable }),
        )
    })
})

describe("RunStopRecordsService.open: one stop per run and step", () => {
    it("writes a new stop by its run and step key, open, with no lines, answers or decision", async () => {
        const { records, store } = await build()

        await records.open(OPEN, NOW)

        expect(store.writes).toHaveLength(1)
        expect(store.writes[0]).toMatchObject({
            op: "insert",
            values: {
                runId: DATA.runId,
                stepKey: "match",
                kind: "ai_error",
                state: "open",
                customerLines: [],
                answers: [],
                decision: null,
                repeats: 1,
            },
        })
    })

    it("opens the same stop again when the step stops again after a decision: one more repeat, the new words, its lines and answers kept", async () => {
        const answered: RunStop = {
            ...STOP,
            version: "4",
            state: "resolved",
            answers: [{ kind: "answer", text: "ghi nh\u1eadn", by: "u1", at: NOW }],
            customerLines: [{ conversationId: "c-1", text: "x", at: NOW }],
            decision: { kind: "answer", text: "ghi nh\u1eadn", by: "u1", at: NOW },
            cardMessageId: "33333333-3333-4333-8333-333333333333",
        }
        const { records, store } = await build([answered])

        const stop = await records.open(OPEN, LATER)

        const update = store.writes.find((write) => write.op === "update")
        expect(update).toMatchObject({
            values: { state: "open", decision: null, repeats: 2, stoppedAt: LATER, resolvedAt: null, kind: "ai_error" },
        })
        expect(update?.values.answers).toBeUndefined()
        expect(stop).toMatchObject({
            state: "open",
            repeats: 2,
            answers: [{ text: "ghi nh\u1eadn" }],
            customerLines: [{ conversationId: "c-1" }],
            cardMessageId: "33333333-3333-4333-8333-333333333333",
        })
    })
})

describe("RunStopRecordsService.newest: the open stops of a workspace, for the schedule list", () => {
    it("lists one bounded page of the newest stops of a state", async () => {
        const many = Array.from({ length: 120 }, (_, at) => ({
            ...STOP,
            id: `stop-${String(at).padStart(3, "0")}`,
            stepKey: `s${at}`,
            stoppedAt: new Date(Date.parse(NOW) + at * 1000).toISOString(),
        }))
        const { records } = await build([...many, { ...STOP, id: "closed", stepKey: "closed", state: "resolved" }])

        const stops = await records.newest("ws-1", "open", 500)

        expect(stops).toHaveLength(100)
        expect(stops.every((stop) => stop.state === "open")).toBe(true)
        expect(stops[0]?.id).toBe("stop-119")
    })
})
