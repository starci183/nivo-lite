import { doorPort, outboxPort } from "@nivo-lite/agent-sdk/mutation"
import { portsOf } from "@nivo-lite/agent-sdk/port"
import { q } from "@nivo-lite/agent-sdk/query"
import type { FilterExpr } from "@nivo-lite/agent-sdk/query"
import { z } from "zod"
import { ADJUSTMENT, CLAIM, INVOICE, ORDER, TRANSACTION } from "../../../rules/accounting/accounting.fixtures"
import { membersPort } from "../../platform/ports"
import { ENTRIES_LIST, ORDERS, TRANSACTIONS } from "../ports"
import {
    ACCOUNTANT_ID,
    doorApi,
    entityApi,
    entriesList,
    memoryProvider,
    memoryWorld,
    putAdjustment,
    putBookEntry,
    putClaim,
    putConversation,
    putInvoice,
    putLead,
    putOrder,
    putRecord,
    putTransaction,
    rowsOf,
    withEntity,
} from "./accounting.memory"

const ENTRY = {
    id: "e1",
    version: "1",
    kind: "income",
    sourceEntity: "payment.transaction",
    sourceId: TRANSACTION.id,
    entryDate: "2026-11-04",
    amountVnd: 100,
    note: null,
    counterparty: null,
    status: "paid",
} as const

const ROW = {
    entryDate: "2026-11-04",
    note: null,
    amountVnd: 100,
    status: "paid",
    counterparty: null,
} as const

const SHAPE = { sort: {}, page: { size: 1 }, row: { id: "id", title: "note" } }

const QUERY = { q: null, filters: {}, sort: "recent", cursor: null, size: 30 }

describe("the memory world", () => {
    it("keeps the records of an entity and answers one by id", async () => {
        const world = memoryWorld()
        putRecord(world, "sales.lead", "l1", { contactName: "Dinh" })
        expect(rowsOf(world, "sales.lead")).toHaveLength(1)
        await expect(entityApi(world, "sales.lead").get("l1")).resolves.toMatchObject({ id: "l1", version: "1" })
        await expect(entityApi(world, "sales.lead").get("nope")).resolves.toBeNull()
    })

    it("stores each kind of record with the links it carries", () => {
        const world = memoryWorld()
        putTransaction(world, { ...TRANSACTION, orderId: ORDER.id })
        putTransaction(world, TRANSACTION)
        putOrder(world, ORDER)
        putOrder(world, { ...ORDER, id: "o2", leadId: null })
        putClaim(world, CLAIM)
        putClaim(world, { ...CLAIM, id: "c2", orderId: null, conversationId: null })
        putInvoice(world, INVOICE, "l1")
        putInvoice(world, { ...INVOICE, id: "i2" })
        putAdjustment(world, ADJUSTMENT)
        putBookEntry(world, ENTRY)
        putLead(world, "l1", "Dinh")
        putConversation(world, "cv1", "l1", "2026-11-01T00:00:00.000Z")
        putConversation(world, "cv2", null, "2026-11-02T00:00:00.000Z")
        expect(world.links.map((link) => `${link.entity}:${link.relation}`)).toEqual([
            "payment.transaction:order",
            "sales.order:lead",
            "payment.claim:order",
            "payment.claim:conversation",
            "accounting.invoice:lead",
            "chat.conversation:lead",
        ])
        expect(rowsOf(world, "accounting.invoice")[0]?.createdAt).toBe(INVOICE.createdAt)
    })
})

describe("the memory engine lists", () => {
    it("pages a query in its order, joins a toOne record and cuts the fields", async () => {
        const world = memoryWorld()
        putLead(world, "l1", "Dinh")
        putOrder(world, ORDER)
        putOrder(world, { ...ORDER, id: "o2", orderNo: "DH-2", leadId: null })
        const orders = entityApi(world, "sales.order")
        const query = {
            select: ["orderNo"],
            join: { lead: ["contactName"] },
            order: [["id", "asc"]] as const,
            page: { size: 1 },
        }
        const first = await orders.list(query)
        expect(first.rows.map((row) => row.row.id)).toEqual([ORDER.id])
        expect(first.rows[0]?.row.data).toEqual({ orderNo: "DH-20261104-0001" })
        expect(first.rows[0]?.joined).toEqual({ lead: { id: "00000000-0000-4000-8000-0000000000c1", data: {} } })
        expect(first.next).toBe("1")
        const second = await orders.list({ ...query, page: { size: 1, after: "1" } })
        expect(second.rows[0]?.joined).toEqual({ lead: null })
        expect(second.next).toBeNull()
    })

    it("joins the target record of a link when it exists", async () => {
        const world = memoryWorld()
        putLead(world, "l1", "Dinh")
        putRecord(world, "sales.order", "o1", { orderNo: "A", status: "draft" }, { links: { lead: "l1" } })
        const page = await entityApi(world, "sales.order").list({
            select: ["orderNo"],
            join: { lead: ["contactName"] },
            where: q.eq("id", "o1"),
            order: [["id", "asc"]],
            page: { size: 1 },
        })
        expect(page.rows[0]?.joined).toEqual({ lead: { id: "l1", data: { contactName: "Dinh" } } })
    })

    it("filters by equality, membership, range and conjunction, and sorts numbers by size", async () => {
        const world = memoryWorld()
        putBookEntry(world, { ...ENTRY, id: "e1", amountVnd: 9, entryDate: "2026-11-01" })
        putBookEntry(world, { ...ENTRY, id: "e2", amountVnd: 10, entryDate: "2026-11-02", kind: "invoice" })
        putBookEntry(world, { ...ENTRY, id: "e3", amountVnd: 10, entryDate: "2026-12-01" })
        const book = entityApi(world, "accounting.book-entry")
        const ids = async (where: FilterExpr): Promise<ReadonlyArray<string>> =>
            (
                await book.list({
                    select: ["kind"],
                    where,
                    order: [
                        ["amountVnd", "desc"],
                        ["id", "desc"],
                    ],
                    page: { size: 10 },
                })
            ).rows.map((row) => row.row.id)
        await expect(ids(q.in("kind", ["income", "invoice"]))).resolves.toEqual(["e3", "e2", "e1"])
        await expect(ids(q.and(q.eq("kind", "income"), q.gte("entryDate", "2026-11-02")))).resolves.toEqual(["e3"])
        await expect(ids(q.lt("entryDate", "2026-11-02"))).resolves.toEqual(["e1"])
        await expect(ids(q.ne("kind", "income"))).resolves.toEqual([])
    })

    it("refuses what the planner refuses", async () => {
        const world = memoryWorld()
        await expect(
            entityApi(world, "sales.order").list({ select: ["nope"], order: [["id", "asc"]], page: { size: 1 } }),
        ).rejects.toThrow("QUERY_FIELD_UNKNOWN")
        await expect(
            entityApi(world, "sales.order").aggregate({ measures: { sum: { kind: "sum" } }, limit: 1 }),
        ).rejects.toThrow("QUERY_OP_INVALID")
    })
})

describe("the memory engine aggregates", () => {
    it("counts and sums with and without groups, and answers a null sum for no row", async () => {
        const world = memoryWorld()
        putBookEntry(world, { ...ENTRY, id: "e1", amountVnd: 9 })
        putBookEntry(world, { ...ENTRY, id: "e2", amountVnd: 10, kind: "invoice" })
        putBookEntry(world, { ...ENTRY, id: "e3", amountVnd: 1 })
        const book = entityApi(world, "accounting.book-entry")
        const measures = { count: { kind: "count" }, vnd: { kind: "sum", field: "amountVnd" } } as const
        await expect(book.aggregate({ groupBy: ["kind"], measures, limit: 10 })).resolves.toEqual([
            { groups: { kind: "income" }, measures: { count: 2, vnd: 10 } },
            { groups: { kind: "invoice" }, measures: { count: 1, vnd: 10 } },
        ])
        await expect(book.aggregate({ measures, limit: 1 })).resolves.toEqual([
            { groups: {}, measures: { count: 3, vnd: 20 } },
        ])
        await expect(book.aggregate({ where: q.eq("kind", "adjustment"), measures, limit: 1 })).resolves.toEqual([
            { groups: {}, measures: { count: 0, vnd: null } },
        ])
        await expect(
            book.aggregate({
                measures: { named: { kind: "count", where: q.eq("kind", "invoice") } },
                limit: 1,
            }),
        ).resolves.toEqual([{ groups: {}, measures: { named: 1 } }])
    })
})

describe("the memory engine sums", () => {
    it("leaves out a record that has no number in the field", async () => {
        const world = memoryWorld()
        putRecord(world, "accounting.book-entry", "e1", { kind: "income", amountVnd: 4 })
        putRecord(world, "accounting.book-entry", "e2", { kind: "income", amountVnd: null })
        await expect(
            entityApi(world, "accounting.book-entry").aggregate({
                measures: { vnd: { kind: "sum", field: "amountVnd" } },
                limit: 1,
            }),
        ).resolves.toEqual([{ groups: {}, measures: { vnd: 4 } }])
    })
})

describe("the memory engine writes", () => {
    it("inserts with links, mints ids and refuses a second value of a unique constraint", async () => {
        const world = memoryWorld()
        const transactions = entityApi(world, "payment.transaction")
        const values = { amountVnd: 1, externalRef: "x1" }
        const first = await transactions.insert(values, { order: "o1" })
        expect(first).toMatchObject({ ok: true, created: true, version: "1" })
        await expect(transactions.insert(values)).resolves.toEqual({
            ok: false,
            reason: "taken",
            constraint: "external_ref_key",
            refusal: "transaction-already-recorded",
        })
        await expect(transactions.insert({ amountVnd: 2 })).resolves.toMatchObject({ ok: true })
        expect(world.links).toHaveLength(1)
    })

    it("updates a record at its version, bumps it, and refuses a stale, a missing or a clashing write", async () => {
        const world = memoryWorld()
        putTransaction(world, TRANSACTION)
        putTransaction(world, { ...TRANSACTION, id: "t2", orderId: "o9" })
        const transactions = entityApi(world, "payment.transaction")
        await expect(transactions.update(TRANSACTION.id, "3", { status: "matched" })).resolves.toMatchObject({
            ok: true,
            version: "4",
        })
        await expect(transactions.update(TRANSACTION.id, "3", { status: "matched" })).resolves.toEqual({
            ok: false,
            reason: "stale",
        })
        await expect(transactions.update("nope", "1", {})).resolves.toEqual({ ok: false, reason: "missing" })
        await expect(transactions.update(TRANSACTION.id, "4", { orderId: "o9" })).resolves.toMatchObject({
            ok: false,
            reason: "taken",
        })
    })

    it("upserts on a unique constraint: inserts the first, rewrites the same, and refuses an unknown constraint", async () => {
        const world = memoryWorld()
        const book = entityApi(world, "accounting.book-entry")
        const values = { kind: "income", sourceEntity: "payment.transaction", sourceId: "t1", amountVnd: 1 }
        await expect(book.upsert("source_key", values)).resolves.toMatchObject({ ok: true, version: "1" })
        await expect(book.upsert("source_key", { ...values, amountVnd: 2 })).resolves.toMatchObject({
            ok: true,
            version: "2",
        })
        expect(rowsOf(world, "accounting.book-entry")).toHaveLength(1)
        await expect(book.upsert("nope", values)).resolves.toEqual({ ok: false, reason: "invalid" })
    })

    it("links a record to another, and answers missing for a record that is not there", async () => {
        const world = memoryWorld()
        putTransaction(world, TRANSACTION)
        const transactions = entityApi(world, "payment.transaction")
        await expect(transactions.link(TRANSACTION.id, "order", "o1")).resolves.toMatchObject({ ok: true })
        await expect(transactions.link("nope", "order", "o1")).resolves.toEqual({ ok: false, reason: "missing" })
        expect(world.links).toEqual([
            { entity: "payment.transaction", id: TRANSACTION.id, relation: "order", to: "o1" },
        ])
    })

    it("stores a record of an entity that declares nothing, with nothing to clash with", async () => {
        const world = memoryWorld()
        const records = entityApi(world, "elsewhere.thing")
        await expect(records.insert({ a: 1 })).resolves.toMatchObject({ ok: true })
        await expect(records.insert({ a: 1 })).resolves.toMatchObject({ ok: true })
    })

    it("finds the record a match key names or inserts it, and refuses a match key the entity does not declare", async () => {
        const world = memoryWorld()
        const leads = entityApi(world, "sales.lead")
        const first = await leads.ensure("phone", { contactName: "Lan", phone: "84900000001" })
        expect(first).toMatchObject({ ok: true, created: true })
        const again = await leads.ensure("phone", { contactName: "Other", phone: "84900000001" })
        expect(again).toMatchObject({ ok: true, created: false })
        expect(rowsOf(world, "sales.lead")).toHaveLength(1)
        await expect(leads.ensure("nope", { contactName: "x" })).resolves.toEqual({ ok: false, reason: "invalid" })
        const none = entityApi(world, "elsewhere.thing")
        await expect(none.ensure("nope", {})).resolves.toEqual({ ok: false, reason: "invalid" })
    })

    it("deletes a record at its version and the links it carries, and refuses a stale or an absent record", async () => {
        const world = memoryWorld()
        putTransaction(world, { ...TRANSACTION, orderId: "o1" })
        putTransaction(world, { ...TRANSACTION, id: "t2", orderId: "o2" })
        const transactions = entityApi(world, "payment.transaction")
        await expect(transactions.delete("nope")).resolves.toEqual({ ok: false, reason: "missing" })
        await expect(transactions.delete(TRANSACTION.id, "99")).resolves.toEqual({ ok: false, reason: "stale" })
        await expect(transactions.delete(TRANSACTION.id)).resolves.toMatchObject({ ok: true })
        expect(rowsOf(world, "payment.transaction")).toHaveLength(1)
        expect(world.links).toEqual([{ entity: "payment.transaction", id: "t2", relation: "order", to: "o2" }])
    })

    it("fills the defaults the entity declares under what an insert gives", async () => {
        const world = memoryWorld()
        const members = entityApi(world, "loyalty.member")
        await members.insert({ name: "Lan" })
        expect(rowsOf(world, "loyalty.member")[0]?.data).toMatchObject({
            name: "Lan",
            points: 0,
            note: "",
            activity: "new",
            joinedAt: "2026-11-04T12:00:00.000Z",
        })
    })

    it("does not run the calls the module never makes", async () => {
        const transactions = entityApi(memoryWorld(), "payment.transaction")
        await expect(transactions.unlink("x", "order", "o1")).rejects.toThrow("does not run")
    })
})

describe("the memory ports", () => {
    it("lists the entries of the books and counts them by the filter", async () => {
        const world = memoryWorld()
        putBookEntry(world, { ...ENTRY, id: "e1", note: "a" })
        putBookEntry(world, { ...ENTRY, id: "e2", kind: "invoice" })
        putBookEntry(world, { ...ENTRY, id: "e3", kind: "adjustment" })
        const list = entriesList(world)
        await expect(list.page(SHAPE, QUERY)).resolves.toEqual({
            rows: [
                { ...ROW, id: "e1", note: "a", kind: "income" },
                { ...ROW, id: "e2", kind: "invoice" },
                { ...ROW, id: "e3", kind: "adjustment" },
            ],
            cursor: null,
        })
        const filtered = await list.page(SHAPE, { ...QUERY, filters: { kind: "invoice" } })
        expect(filtered.rows.map((row) => row.id)).toEqual(["e2"])
        const open = await list.page(SHAPE, { ...QUERY, filters: { status: "open" } })
        expect(open.rows).toEqual([])
        const paid = await list.page(SHAPE, { ...QUERY, filters: { status: "paid" } })
        expect(paid.rows).toHaveLength(3)
        await expect(list.counts(SHAPE, "kind", QUERY)).resolves.toEqual({ income: 1, invoice: 1, adjustment: 1 })
    })

    it("answers the seats, the outbox and the door, and leaves a port outside the module unprovided", async () => {
        const world = memoryWorld()
        world.answers.set("chat.send", { ok: true, output: null })
        const provider = memoryProvider(world)
        const { members, outbox, door, transactions, entries } = portsOf(provider, {
            members: membersPort,
            outbox: outboxPort,
            door: doorPort,
            transactions: TRANSACTIONS,
            entries: ENTRIES_LIST,
        })
        await expect(members.get(ACCOUNTANT_ID)).resolves.toMatchObject({ displayName: "Lan" })
        await expect(members.get("nobody")).resolves.toBeNull()
        await outbox.enqueue(
            { name: "a.b", input: z.object({ id: z.string().max(40) }) },
            { id: "x" },
            { dedupeKey: "k" },
        )
        await outbox.enqueue({ name: "a.c", input: z.object({ id: z.string().max(40) }) }, { id: "y" })
        expect(world.jobs).toEqual([
            { job: "a.b", input: { id: "x" }, dedupeKey: "k" },
            { job: "a.c", input: { id: "y" }, dedupeKey: undefined },
        ])
        await expect(doorApi(world).call("chat.send", { a: 1 })).resolves.toEqual({ ok: true, output: null })
        await expect(door.call("ledger.status", {})).resolves.toEqual({
            ok: false,
            reason: "unknown_tool",
            message: "ledger.status",
        })
        expect(world.calls.map((call) => call.tool)).toEqual(["chat.send", "ledger.status"])
        await expect(transactions.get("nope")).resolves.toBeNull()
        await expect(entries.page(SHAPE, QUERY)).resolves.toEqual({ rows: [], cursor: null })
        expect(() => provider.implementationOf({ entry: "port", id: "elsewhere.thing" })).toThrow("PORT_UNPROVIDED")
    })
})

describe("a world with one port patched", () => {
    it("answers the patched call for the entity it names and every other call as the world does", async () => {
        const world = memoryWorld()
        putTransaction(world, TRANSACTION)
        putOrder(world, ORDER)
        const provider = withEntity(world, "payment.transaction", {
            update: () => Promise.resolve({ ok: false, reason: "stale" }),
        })
        const { transactions, orders } = portsOf(provider, { transactions: TRANSACTIONS, orders: ORDERS })
        await expect(transactions.update(TRANSACTION.id, "3", {})).resolves.toEqual({ ok: false, reason: "stale" })
        await expect(transactions.get(TRANSACTION.id)).resolves.toMatchObject({ id: TRANSACTION.id })
        await expect(orders.update(ORDER.id, "2", { status: "paid" })).resolves.toMatchObject({ ok: true })
    })
})
