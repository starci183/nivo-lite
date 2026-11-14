import { Test } from "@nestjs/testing"
import { FakeClock } from "@starci/jest-preset"
import type { MemoryWrite } from "@nivo-lite/agent-sdk/node"
import { CONTACT_MEMORY_STORE, type ContactMemoryValues } from "@modules/domain/contacts"
import { CLOCK } from "@modules/platform/clock"
import { MemoryContactMemoryStore, memoryEntryOf } from "@tests/fixtures/builders/contact-memory-store.builder"
import { LeadMemoryService } from "./lead-memory.service"
import { factsValuesOf, contactMemorySubjectOf, stepValuesOf } from "./lead-memory.policy"

const NOW = new Date("2026-11-09T00:00:00.000Z")
const LEAD = contactMemorySubjectOf("l1", "c1")

const rowOf = (values: ContactMemoryValues, id: string) => memoryEntryOf(values, id, NOW.toISOString())

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

/** A memory over entries kept in memory: every write is recorded in order. */
const build = async (rows: ReadonlyArray<ReturnType<typeof rowOf>>) => {
    const memory = new MemoryContactMemoryStore(rows, () => NOW.toISOString())
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadMemoryService,
            { provide: CONTACT_MEMORY_STORE, useValue: memory },
            { provide: CLOCK, useValue: new FakeClock(NOW.getTime()) },
        ],
    }).compile()
    return { store: moduleRef.get(LeadMemoryService), memory }
}

describe("LeadMemoryService", () => {
    it("writes the outcome, the trigger and merges the facts, all as upserts on the entry key", async () => {
        const { store, memory } = await build([])
        await store.write("ws", WRITE)
        expect(memory.writes.map((op) => [op.op, "values" in op ? op.values.entryKey : null])).toEqual([
            ["put", "contact:l1|sales.consult|order"],
            ["put", "contact:l1|sales.consult|$trigger"],
            ["put", "contact:l1|$lead|$facts"],
        ])
    })

    it("merges facts over the held entry under its version", async () => {
        const held = rowOf(factsValuesOf(LEAD, {}, { phone: "0901" }, NOW), "f1")
        const { store, memory } = await build([held])
        await store.write("ws", WRITE)
        const update = memory.writes.find((op) => op.op === "update")
        expect(update).toMatchObject({
            id: "f1",
            expected: 1,
            values: { output: { value: { phone: "0901", address: "335 Ba Trieu" } } },
        })
    })

    it("remembers what a step says was learned over the held facts entry, care facts included, and nothing for none", async () => {
        const held = rowOf(factsValuesOf(LEAD, {}, { phone: "0901" }, NOW), "f1")
        const { store, memory } = await build([held])
        await store.remember("ws", LEAD, { careOptOut: true, occasions: [{ label: "sinh nhat", date: "11-14" }], budget: 5 })
        await store.remember("ws", LEAD, {})
        expect(memory.writes).toHaveLength(1)
        expect(memory.writes[0]).toMatchObject({
            op: "update",
            id: "f1",
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

    it("moves a conversation's entries to the contact, closes a contact's memory for retention and sweeps what is due", async () => {
        const conversation = { key: "conversation:c1", contactId: null, conversationId: "c1" }
        const moved = rowOf(stepValuesOf({ ...WRITE, subject: conversation }, NOW), "m1")
        const { store, memory } = await build([moved])
        await store.adopt("ws", "c1", "l1")
        expect(memory.writes[0]).toMatchObject({ op: "put", values: { entryKey: "contact:l1|sales.consult|order", contactId: "l1" } })
        expect(memory.writes[1]).toMatchObject({ op: "remove", id: "m1" })

        const closing = await build([rowOf(stepValuesOf(WRITE, NOW), "s1")])
        await closing.store.closed("ws", "l1", NOW)
        expect(closing.memory.writes[0]).toMatchObject({
            values: { closedAt: NOW.toISOString(), expiresAt: "2026-12-09T00:00:00.000Z" },
        })

        const due = await build([rowOf({ ...stepValuesOf(WRITE, NOW), expiresAt: "2026-01-01T00:00:00.000Z" }, "old")])
        await expect(due.store.sweep("ws", NOW)).resolves.toBe(1)
        expect(due.memory.writes[0]).toEqual({ op: "remove", id: "old" })
    })

    it("reads a customer with more entries than one engine page holds, and sweeps one page of what is due", async () => {
        const many = Array.from({ length: 250 }, (_, at) =>
            rowOf(stepValuesOf({ ...WRITE, nodeKey: `n${at}` }, NOW), `s${String(at).padStart(3, "0")}`),
        )
        const { store } = await build(many)
        const snapshot = await store.snapshot("ws", LEAD, "step")
        expect(Object.keys(snapshot?.workflows["sales.consult"] ?? {})).toHaveLength(250)
        await expect(store.sweep("ws", new Date("2030-01-01T00:00:00.000Z"))).resolves.toBe(200)
    })
})
