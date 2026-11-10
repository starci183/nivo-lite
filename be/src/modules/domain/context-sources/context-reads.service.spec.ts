import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import type { PageRow, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { LeadMemorySnapshot } from "@nivo-lite/agent-sdk/node"
import { queryProblems } from "@nivo-lite/agent-sdk/query"
import type { Query } from "@nivo-lite/agent-sdk/query"
import { FLOW_F_ENTITIES } from "@nivo-lite/blocks-core/entities"
import { EntityEngineService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import { LeadMemoryService } from "@modules/domain/lead-memory"
import { CLOCK } from "@modules/platform/clock"
import { ContextReadsService } from "./context-reads.service"
import { CONTEXT_NOTICE } from "./context-sources.policy"

const WS = "11111111-1111-4111-8111-111111111111"
const AT = "2026-11-10T03:00:00.000Z"
const NOW = new Date("2026-11-11T01:00:00.000Z")

/** The real entity declarations by name: the engine refuses a list no declared index serves, and so does this fake. */
const CATALOG: ReadonlyMap<string, EntityDefinition> = new Map(
    FLOW_F_ENTITIES.map((entity): [string, EntityDefinition] => [entity.name, entity as EntityDefinition]),
)

const recordOf = (id: string, data: Readonly<Record<string, unknown>>): RecordRow => ({
    id,
    workspaceId: WS,
    version: "1",
    createdAt: AT,
    updatedAt: AT,
    data,
})

const pageRowOf = (id: string, data: Readonly<Record<string, unknown>>): PageRow => ({
    row: recordOf(id, data),
    joined: {},
    position: [id],
    included: {},
})

const ORDER = {
    leadId: "lead-1",
    orderNo: "DH-20261110-0004",
    status: "paid",
    amountVnd: 3000,
    itemsText: "2 x Gio hoa nho",
    recipientName: "Lan",
    recipientPhone: "0901",
    deliveryAddress: "25 Nguyen Hue",
    deliveryAt: "thu bay 9-11",
    confirmedAt: AT,
    shippedAt: null,
    carrier: null,
    trackingCode: null,
    note: "khach quen",
    confirmedBy: "owner",
}

const LEAD = { contactName: "An", phone: "0909", email: null, channel: "zalo", stage: "won", note: "VIP", need: null }

const SNAPSHOT: LeadMemorySnapshot = {
    subject: { key: "lead:lead-1", leadId: "lead-1", conversationId: "conv-1" },
    lead: { name: "An", address: "25 Nguyen Hue" },
    workflows: {
        consult: {
            consult: { status: "done", output: { address: "25 Nguyen Hue" }, error: null, runId: "r-1", versionId: "v", at: AT },
        },
        reconcile: {
            match: {
                status: "failed",
                output: null,
                error: { code: "X", messageKey: "", message: "", fields: {} },
                runId: "r-2",
                versionId: "v",
                at: "2026-11-10T04:00:00.000Z",
            },
        },
    },
}

const build = async (memory = true) => {
    const engine = mock<EntityEngineService>()
    const lists: Array<Query> = []
    engine.scoped.mockImplementation((_workspace, work) => work(mock<ScopedTx>()))
    engine.definition.mockImplementation((name) => {
        const entity = CATALOG.get(name)
        if (entity === undefined) throw new Error(`unknown entity ${name}`)
        return entity
    })
    engine.get.mockImplementation((_tx, entity, id) => {
        if (entity === "chat.conversation") return Promise.resolve(recordOf(id, { leadId: id === "conv-1" ? "lead-1" : null }))
        if (entity === "sales.lead" && id === "lead-1") return Promise.resolve(recordOf(id, LEAD))
        return Promise.resolve(null)
    })
    engine.list.mockImplementation((_tx, query: Query) => {
        lists.push(query)
        const problems = queryProblems(query, CATALOG)
        if (problems.length > 0) return Promise.reject(new Error(`ENTITY_ENGINE_QUERY_INVALID ${JSON.stringify(problems)}`))
        if (query.from === "sales.order") return Promise.resolve({ rows: [pageRowOf("o-4", ORDER)], next: null })
        if (query.from === "chat.message") {
            return Promise.resolve({
                rows: [
                    pageRowOf("m-2", { role: "agent", text: "Da a", sentAt: "2026-11-10T03:02:00.000Z" }),
                    pageRowOf("m-1", { role: "user", text: "don gan nhat cua toi?", sentAt: AT }),
                    pageRowOf("m-0", { role: "user", text: "", sentAt: AT }),
                ],
                next: null,
            })
        }
        return Promise.resolve({ rows: [], next: null })
    })
    const leadMemory = mock<LeadMemoryService>()
    leadMemory.snapshot.mockResolvedValue(SNAPSHOT)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ContextReadsService,
            { provide: EntityEngineService, useValue: engine },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            ...(memory ? [{ provide: LeadMemoryService, useValue: leadMemory }] : []),
        ],
    }).compile()
    return { reads: moduleRef.get(ContextReadsService), engine, lists, leadMemory }
}

const SUBJECT = { conversationId: "conv-1", leadId: "lead-1" }

describe("ContextReadsService: every read is served by an index of the real entity", () => {
    it("reads the thread and the orders with queries the engine's real declarations accept", async () => {
        const { reads, lists } = await build()

        await reads.thread(WS, SUBJECT, 20)
        await reads.orders(WS, SUBJECT, "internal", 5)

        expect(lists.map((query) => queryProblems(query, CATALOG))).toEqual([[], []])
        expect(lists.map((query) => [query.from, query.where])).toEqual([
            ["chat.message", { op: "eq", field: "conversationId", value: "conv-1" }],
            ["sales.order", { op: "eq", field: "leadId", value: "lead-1" }],
        ])
    })

    it("finds the customer a conversation names by its id, null for one that names none", async () => {
        const { reads } = await build()

        await expect(reads.leadOfConversation(WS, "conv-1")).resolves.toBe("lead-1")
        await expect(reads.leadOfConversation(WS, "conv-2")).resolves.toBeNull()
    })
})

describe("ContextReadsService: the uniform result (notice, source, as of, facts)", () => {
    it("answers the thread newest first, a line with no words left out", async () => {
        const { reads } = await build()

        await expect(reads.thread(WS, SUBJECT, 20)).resolves.toEqual({
            notice: CONTEXT_NOTICE,
            source: "nivo.conversation",
            asOf: NOW.toISOString(),
            facts: [
                { role: "agent", text: "Da a", at: "2026-11-10T03:02:00.000Z" },
                { role: "user", text: "don gan nhat cua toi?", at: AT },
            ],
        })
    })

    it("answers nothing, and reads nothing, for a run with no conversation or no customer", async () => {
        const { reads, engine, leadMemory } = await build()
        const none = { conversationId: null, leadId: null }

        expect((await reads.thread(WS, none, 20)).facts).toEqual([])
        expect((await reads.orders(WS, none, "internal", 5)).facts).toEqual([])
        expect((await reads.profile(WS, none, "internal")).facts).toEqual([])
        expect((await reads.notes(WS, none, "internal", 5)).facts).toEqual([])
        expect(engine.list).not.toHaveBeenCalled()
        expect(engine.get).not.toHaveBeenCalled()
        expect(leadMemory.snapshot).not.toHaveBeenCalled()
    })
})

describe("ContextReadsService: a customer-facing run reads public facts only", () => {
    it("serves the customer's orders without the shop's internal fields", async () => {
        const { reads } = await build()

        const [customer] = (await reads.orders(WS, SUBJECT, "customer", 5)).facts
        const [internal] = (await reads.orders(WS, SUBJECT, "internal", 5)).facts

        expect(customer).toMatchObject({ id: "o-4", orderNo: "DH-20261110-0004", status: "paid", deliveryAddress: "25 Nguyen Hue" })
        expect(customer).not.toHaveProperty("note")
        expect(customer).not.toHaveProperty("confirmedBy")
        expect(internal).toMatchObject({ note: "khach quen", confirmedBy: "owner" })
    })

    it("serves the profile without the pipeline or the shop's note, and with what the workflows remember", async () => {
        const { reads } = await build()

        const [customer] = (await reads.profile(WS, SUBJECT, "customer")).facts
        const [internal] = (await reads.profile(WS, SUBJECT, "internal")).facts

        expect(customer).toEqual({
            id: "lead-1",
            contactName: "An",
            phone: "0909",
            email: null,
            channel: "zalo",
            createdAt: AT,
            remembered: { name: "An", address: "25 Nguyen Hue" },
        })
        expect(internal).toMatchObject({ stage: "won", note: "VIP" })
    })

    it("serves notes newest first; a customer-facing run sees the outcomes that ended done only", async () => {
        const { reads } = await build()

        const customer = (await reads.notes(WS, SUBJECT, "customer", 10)).facts
        const internal = (await reads.notes(WS, SUBJECT, "internal", 10)).facts

        expect(customer.map((note) => [note.workflow, note.step])).toEqual([["consult", "consult"]])
        expect(internal.map((note) => [note.workflow, note.status])).toEqual([
            ["reconcile", "failed"],
            ["consult", "done"],
        ])
    })

    it("reads the record alone in an app with no lead memory", async () => {
        const { reads } = await build(false)

        expect((await reads.profile(WS, SUBJECT, "customer")).facts[0]?.remembered).toEqual({})
        expect((await reads.notes(WS, SUBJECT, "internal", 10)).facts).toEqual([])
    })
})
