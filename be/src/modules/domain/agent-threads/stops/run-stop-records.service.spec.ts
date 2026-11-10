import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { EntityEngineService, EntityMutationService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { RunStopsErrorCode } from "./errors/run-stops.error"
import { RunStopRecordsService, runStopOf } from "./run-stop-records.service"
import type { StopOpen } from "./run-stop.contracts"

const NOW = "2026-11-10T10:00:00.000Z"
const LATER = "2026-11-10T11:00:00.000Z"

const DATA = {
    runId: "11111111-1111-4111-8111-111111111111",
    stepKey: "match",
    agentId: "22222222-2222-4222-8222-222222222222",
    workflowId: null,
    leadId: null,
    conversationId: null,
    kind: "ai_report",
    state: "open",
    reason: "why",
    question: null,
    detail: { suggestions: [], facts: [{ name: "amount", value: "1.000đ" }] },
    cardMessageId: null,
    customerLines: { lines: [] },
    answers: { answers: [] },
    decision: null,
    repeats: 1,
    stoppedAt: NOW,
    resolvedAt: null,
}

const rowOf = (data: Readonly<Record<string, unknown>> = DATA, version = "1"): RecordRow => ({
    id: "stop-1",
    workspaceId: "ws-1",
    version,
    createdAt: NOW,
    updatedAt: NOW,
    data: data as RecordRow["data"],
})

const OPEN: StopOpen = {
    workspaceId: "ws-1",
    runId: DATA.runId,
    stepKey: "match",
    agentId: DATA.agentId,
    workflowId: null,
    leadId: null,
    conversationId: null,
    kind: "ai_error",
    reason: "AI lỗi",
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

const build = async () => {
    const engine = mock<EntityEngineService>()
    const mutations = mock<EntityMutationService>()
    engine.scoped.mockImplementation((_ws, work) => work(mock<ScopedTx>()))
    const moduleRef = await Test.createTestingModule({
        providers: [
            RunStopRecordsService,
            { provide: EntityEngineService, useValue: engine },
            { provide: EntityMutationService, useValue: mutations },
        ],
    }).compile()
    return { records: moduleRef.get(RunStopRecordsService), engine, mutations }
}

describe("runStopOf", () => {
    it("reads a stop, its lists unwrapped", () => {
        expect(runStopOf(rowOf())).toMatchObject({
            id: "stop-1",
            runId: DATA.runId,
            kind: "ai_report",
            state: "open",
            detail: { facts: [{ name: "amount", value: "1.000đ" }] },
            customerLines: [],
            answers: [],
            decision: null,
        })
    })

    it("refuses a record that is not the shape of a stop", () => {
        expect(() => runStopOf(rowOf({ ...DATA, kind: "mystery" }))).toThrow(
            expect.objectContaining({ code: RunStopsErrorCode.RecordUnreadable }),
        )
        expect(() => runStopOf(rowOf({ ...DATA, answers: [] }))).toThrow(
            expect.objectContaining({ code: RunStopsErrorCode.RecordUnreadable }),
        )
    })
})

describe("RunStopRecordsService.open: one record per run and step", () => {
    it("writes a new stop by its run and step key, open, with no lines, answers or decision", async () => {
        const { records, mutations } = await build()
        mutations.mutate.mockResolvedValue({ ok: true, row: rowOf(), version: "1", created: true })

        await records.open(OPEN, NOW)

        const [, mutation] = mutations.mutate.mock.calls[0] ?? []
        expect(mutation).toMatchObject({
            op: "ensure",
            entity: "agent.run-stop",
            match: "run_step",
            values: {
                runId: DATA.runId,
                stepKey: "match",
                kind: "ai_error",
                state: "open",
                customerLines: { lines: [] },
                answers: { answers: [] },
                decision: null,
                repeats: 1,
            },
        })
        expect(mutations.mutate).toHaveBeenCalledTimes(1)
    })

    it("opens the same record again when the step stops again after a decision: one more repeat, the new words, its lines and answers kept", async () => {
        const { records, engine, mutations } = await build()
        const answered = {
            ...DATA,
            state: "resolved",
            answers: { answers: [{ kind: "answer", text: "ghi nhận", by: "u1", at: NOW }] },
            customerLines: { lines: [{ conversationId: "c-1", text: "x", at: NOW }] },
            decision: { kind: "answer", text: "ghi nhận", by: "u1", at: NOW },
            cardMessageId: "33333333-3333-4333-8333-333333333333",
        }
        mutations.mutate
            .mockResolvedValueOnce({ ok: true, row: rowOf(answered), version: "4", created: false })
            .mockImplementationOnce((_tx, mutation) =>
                Promise.resolve({
                    ok: true,
                    row: rowOf({ ...answered, ...Reflect.get(mutation, "values") }, "5"),
                    version: "5",
                    created: false,
                }),
            )
        engine.get.mockResolvedValue(rowOf(answered, "4"))

        const stop = await records.open(OPEN, LATER)

        const [, update] = mutations.mutate.mock.calls[1] ?? []
        expect(update).toMatchObject({
            op: "update",
            values: { state: "open", decision: null, repeats: 2, stoppedAt: LATER, resolvedAt: null, kind: "ai_error" },
        })
        expect(Reflect.get(Reflect.get(update ?? {}, "values"), "answers")).toBeUndefined()
        expect(stop).toMatchObject({
            state: "open",
            repeats: 2,
            answers: [{ text: "ghi nhận" }],
            customerLines: [{ conversationId: "c-1" }],
            cardMessageId: "33333333-3333-4333-8333-333333333333",
        })
    })
})
