import type { ListQuery, ListShape, ListSource } from "@nivo-lite/agent-sdk/block"
import { definePort } from "@nivo-lite/agent-sdk/port"
import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import { sampleState, SAMPLE_NOW } from "./fixtures/loyalty.data"
import type { MemberListRow } from "./loyalty.types"
import { memoryProvider } from "./memory"
import type { MemoryState } from "./memory"
import { loyaltyLedger, loyaltyMembers, loyaltyMembersList } from "./ports"
import type { LedgerStore, MemberStore } from "./ports"

const isObject = (value: unknown): value is object => typeof value === "object" && value !== null

const isListSource = (value: unknown): value is ListSource<MemberListRow> =>
    isObject(value) && "page" in value && "counts" in value

const isMemberStore = (value: unknown): value is MemberStore => isObject(value) && "ensureByPhone" in value

const isLedgerStore = (value: unknown): value is LedgerStore => isObject(value) && "post" in value

const provided = (state: MemoryState, port: PortDefinition<unknown>): unknown =>
    memoryProvider(state).implementationOf(port)

const QUERY: ListQuery = { q: null, filters: {}, sort: "name", cursor: null, size: 10 }
const SHAPE: ListShape = {
    sort: { name: [["name", "asc"]] },
    page: { size: 10 },
    row: { id: "id", title: "name" },
}

const EARN = {
    customerId: "m-3",
    kind: "earn",
    points: 10,
    ref: "no-amount",
    by: "NIVO",
    amountVnd: null,
    rewardId: null,
    evidence: null,
    expiresAt: null,
    occurredAt: SAMPLE_NOW,
} as const

describe("the in-memory provider", () => {
    it("refuses a port it does not provide", () => {
        expect(() => provided(sampleState(), definePort("loyalty.other"))).toThrow()
    })

    it("lists every row in the order they have for a sort it does not know and a shape with no search", async () => {
        const source = provided(sampleState(), loyaltyMembersList)
        expect(isListSource(source)).toBe(true)
        if (!isListSource(source)) return
        const page = await source.page(SHAPE, { ...QUERY, sort: "nope" })
        expect(page.rows.map((row) => row.id)).toEqual(["m-1", "m-2", "m-3", "m-4", "m-5"])
    })

    it("searches only the fields a shape names, and a field that holds no text matches nothing", async () => {
        const source = provided(sampleState(), loyaltyMembersList)
        expect(isListSource(source)).toBe(true)
        if (!isListSource(source)) return
        const found = await source.page({ ...SHAPE, search: { fields: ["points", "name"] } }, { ...QUERY, q: "tran" })
        expect(found.rows.map((row) => row.id)).toEqual(["m-2"])
        const none = await source.page({ ...SHAPE, search: { fields: ["points"] } }, { ...QUERY, q: "620" })
        expect(none.rows).toEqual([])
    })

    it("matches no row for a filter the shape does not declare, and counts nothing for it", async () => {
        const source = provided(sampleState(), loyaltyMembersList)
        expect(isListSource(source)).toBe(true)
        if (!isListSource(source)) return
        expect((await source.page(SHAPE, { ...QUERY, filters: { nope: "x" } })).rows).toEqual([])
        expect(await source.counts(SHAPE, "nope", QUERY)).toEqual({})
    })

    it("counts an open filter by the values the rows hold, leaving out a row with none, and a closed one by its listed values", async () => {
        const source = provided(sampleState(), loyaltyMembersList)
        expect(isListSource(source)).toBe(true)
        if (!isListSource(source)) return
        const open: ListShape = {
            ...SHAPE,
            filters: { tier: { field: "tierKey", op: "eq", of: ["vang"], open: true } },
        }
        expect(await source.counts(open, "tier", QUERY)).toEqual({ vang: 1, bac: 1, dong: 2 })
        const closed: ListShape = { ...SHAPE, filters: { tier: { field: "tierKey", op: "eq", of: ["vang", "none"] } } }
        expect(await source.counts(closed, "tier", QUERY)).toEqual({ vang: 1, none: 0 })
    })

    it("refuses an update of a member that is gone and one made at a stale version", async () => {
        const store = provided(sampleState(), loyaltyMembers)
        expect(isMemberStore(store)).toBe(true)
        if (!isMemberStore(store)) return
        expect(await store.update("nobody", "1", { name: "x" })).toEqual({ ok: false, reason: "missing" })
        expect(await store.update("m-1", "9", { name: "x" })).toEqual({ ok: false, reason: "conflict" })
    })

    it("counts an earn entry without an amount as no spend", async () => {
        const state = sampleState()
        const ledger = provided(state, loyaltyLedger)
        expect(isLedgerStore(ledger)).toBe(true)
        if (!isLedgerStore(ledger)) return
        await ledger.post(EARN)
        expect(state.members.find((member) => member.id === "m-3")).toMatchObject({
            lifetimeSpendVnd: 950_000,
            points: 190,
            visits: 5,
        })
    })

    it("posts an entry for a customer the memory does not have without touching a balance", async () => {
        const state = sampleState()
        const before = JSON.stringify(state.members)
        const ledger = provided(state, loyaltyLedger)
        expect(isLedgerStore(ledger)).toBe(true)
        if (!isLedgerStore(ledger)) return
        await ledger.post({ ...EARN, customerId: "nobody", ref: "orphan" })
        expect(JSON.stringify(state.members)).toBe(before)
    })
})
