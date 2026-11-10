import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { MemoryWrite } from "@nivo-lite/agent-sdk/node"
import { queryProblems } from "@nivo-lite/agent-sdk/query"
import type { FilterExpr, Query } from "@nivo-lite/agent-sdk/query"
import { FLOW_F_ENTITIES } from "@nivo-lite/blocks-core/entities"
import { EntityEngineService, EntityMutationService } from "@modules/domain/entity-engine"
import { CLOCK } from "@modules/platform/clock"
import { pageOf, wireScope } from "@tests/fixtures/builders/agent-graph-records.builder"
import { LeadMemoryService } from "./lead-memory.service"
import { factsValuesOf, leadMemorySubjectOf, stepValuesOf } from "./lead-memory.policy"

const NOW = new Date("2026-11-09T00:00:00.000Z")
const LEAD = leadMemorySubjectOf("l1", "c1")

const rowOf = (data: Readonly<Record<string, unknown>>, id: string): RecordRow => ({
    id,
    workspaceId: "ws",
    version: "1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    data,
})

const WRITE: MemoryWrite = {
    subject: LEAD,
    namespace: "sales.consult",
    workflowId: null,
    agentId: "a",
    nodeKey: "order",
    step: "sales.order-from-chat",
    outcome: {
        status: "done",
        output: { orderId: "o1", phone: "0901234567" },
        error: null,
        runId: "run",
        versionId: "v",
        at: NOW.toISOString(),
    },
    facts: { address: "335 Ba Trieu" },
    trigger: { text: "hi" },
}

/** Whether a row answers a filter: `eq`, `lt` and `and` of them, which is all the store asks. */
const matches = (row: RecordRow, where: FilterExpr | undefined): boolean => {
    if (where === undefined) return true
    if (where.op === "and") return where.of.every((inner) => matches(row, inner))
    if (where.op === "lt") return String(row.data[where.field]) < String(where.value)
    return where.op === "eq" && row.data[where.field] === where.value
}

/** The real catalog: every list the store asks is judged by the engine's own bounds (the page size above all). */
const CATALOG = new Map(FLOW_F_ENTITIES.map((entity) => [entity.name, entity]))

/** One page of the rows that match, as the engine pages them: the query refused by the real bounds, the cursor the row offset. */
const pageFor = (rows: ReadonlyArray<RecordRow>, query: Query) => {
    const problems = queryProblems(query, CATALOG)
    if (problems.length > 0) return Promise.reject(new TypeError(JSON.stringify(problems)))
    const matching = rows.filter((row) => matches(row, query.where))
    const from = Number(query.page.after ?? "0")
    const to = from + query.page.size
    return Promise.resolve(pageOf(matching.slice(from, to), to < matching.length ? String(to) : null))
}

/** A store over rows kept in memory: lists filter by `eq` (and `and` of `eq`), writes are recorded. */
const build = async (rows: Array<RecordRow>, lead: RecordRow | null = null) => {
    const engine = mock<EntityEngineService>()
    wireScope(engine)
    engine.get.mockResolvedValue(lead)
    engine.list.mockImplementation((_tx, query) => pageFor(rows, query))
    const mutations = mock<EntityMutationService>()
    mutations.mutate.mockResolvedValue({ ok: true, row: rowOf({}, "x"), version: "1" })
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadMemoryService,
            { provide: EntityEngineService, useValue: engine },
            { provide: EntityMutationService, useValue: mutations },
            { provide: CLOCK, useValue: new FakeClock(NOW.getTime()) },
        ],
    }).compile()
    return { store: moduleRef.get(LeadMemoryService), mutations }
}

describe("LeadMemoryService", () => {
    it("writes the outcome, the trigger and merges the facts, all as upserts on the entry key", async () => {
        const { store, mutations } = await build([])
        await store.write("ws", WRITE)
        const ops = jest.mocked(mutations.mutate).mock.calls.map(([, mutation]) => mutation)
        expect(ops.map((op) => [op.op, "values" in op ? op.values.entryKey : null])).toEqual([
            ["upsert", "lead:l1|sales.consult|order"],
            ["upsert", "lead:l1|sales.consult|$trigger"],
            ["upsert", "lead:l1|$lead|$facts"],
        ])
    })

    it("merges facts over the held entry under its version", async () => {
        const held = rowOf(factsValuesOf(LEAD, {}, { phone: "0901" }, NOW), "f1")
        const { store, mutations } = await build([held])
        await store.write("ws", WRITE)
        const update = jest
            .mocked(mutations.mutate)
            .mock.calls.map(([, mutation]) => mutation)
            .find((op) => op.op === "update")
        expect(update).toMatchObject({
            key: "f1",
            expected: "1",
            values: { output: { value: { phone: "0901", address: "335 Ba Trieu" } } },
        })
    })

    it("remembers what lead.update says the consult learned over the held facts entry, care facts included, and nothing for none", async () => {
        const held = rowOf(factsValuesOf(LEAD, {}, { phone: "0901" }, NOW), "f1")
        const { store, mutations } = await build([held])
        await store.remember("ws", LEAD, { careOptOut: true, occasions: [{ label: "sinh nhat", date: "11-14" }], budget: 5 })
        await store.remember("ws", LEAD, {})
        const ops = jest.mocked(mutations.mutate).mock.calls.map(([, mutation]) => mutation)
        expect(ops).toHaveLength(1)
        expect(ops[0]).toMatchObject({
            op: "update",
            key: "f1",
            values: {
                output: { value: { phone: "0901", careOptOut: true, occasions: [{ label: "sinh nhat", date: "11-14" }] } },
            },
        })
    })

    it("answers the snapshot raw for a step and masked for display, and null for a customer with nothing", async () => {
        const rows = [
            rowOf(stepValuesOf(WRITE, NOW), "s1"),
            rowOf(factsValuesOf(LEAD, {}, { phone: "0901234567" }, NOW), "f1"),
        ]
        const { store } = await build(rows)
        const raw = await store.snapshot("ws", LEAD, "step")
        expect(raw?.lead.phone).toBe("0901234567")
        expect(raw?.workflows["sales.consult"]?.["order"]?.output).toEqual({ orderId: "o1", phone: "0901234567" })
        const shown = await store.snapshot("ws", LEAD, "display")
        expect(shown?.lead.phone).toBe("09••••••67")
        expect(shown?.workflows["sales.consult"]?.["order"]?.output).toEqual({ orderId: "o1", phone: "09••••••67" })
        const empty = await build([])
        await expect(empty.store.snapshot("ws", LEAD, "step")).resolves.toBeNull()
    })

    it("recalls one node's outcome of one run", async () => {
        const { store } = await build([rowOf(stepValuesOf(WRITE, NOW), "s1")])
        await expect(store.stepOf("ws", LEAD, "run", "order")).resolves.toMatchObject({ output: { orderId: "o1" } })
        await expect(store.stepOf("ws", LEAD, "other", "order")).resolves.toBeNull()
    })

    it("moves a conversation's entries to the lead, closes a lead for retention and sweeps what is due", async () => {
        const conversation = { key: "conversation:c1", leadId: null, conversationId: "c1" }
        const moved = rowOf(stepValuesOf({ ...WRITE, subject: conversation }, NOW), "m1")
        const { store, mutations } = await build([moved])
        await store.adopt("ws", "c1", "l1")
        const ops = jest.mocked(mutations.mutate).mock.calls.map(([, mutation]) => mutation)
        expect(ops[0]).toMatchObject({ op: "upsert", values: { entryKey: "lead:l1|sales.consult|order", leadId: "l1" } })
        expect(ops[1]).toMatchObject({ op: "delete", key: "m1" })

        const closing = await build([rowOf(stepValuesOf(WRITE, NOW), "s1")])
        await closing.store.closed("ws", "l1", NOW)
        expect(jest.mocked(closing.mutations.mutate).mock.calls[0]?.[1]).toMatchObject({
            values: { closedAt: NOW.toISOString(), expiresAt: "2026-12-09T00:00:00.000Z" },
        })

        const due = await build([rowOf({ ...stepValuesOf(WRITE, NOW), expiresAt: "2026-01-01T00:00:00.000Z" }, "old")])
        await expect(due.store.sweep("ws", NOW)).resolves.toBe(1)
        expect(jest.mocked(due.mutations.mutate).mock.calls[0]?.[1]).toEqual({
            op: "delete",
            entity: "agent.lead-memory",
            key: "old",
        })
    })

    it("reads a customer with more entries than one engine page holds, page by page within the bound", async () => {
        const many = Array.from({ length: 250 }, (_, at) =>
            rowOf(stepValuesOf({ ...WRITE, nodeKey: `n${at}` }, NOW), `s${String(at).padStart(3, "0")}`),
        )
        const { store } = await build(many)
        const snapshot = await store.snapshot("ws", LEAD, "step")
        expect(Object.keys(snapshot?.workflows["sales.consult"] ?? {})).toHaveLength(250)
        await expect(store.sweep("ws", new Date("2030-01-01T00:00:00.000Z"))).resolves.toBe(200)
    })
})
