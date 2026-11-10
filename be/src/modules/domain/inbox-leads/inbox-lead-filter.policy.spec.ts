import { Test } from "@nestjs/testing"
import { countsOf, inTab, matchesSearch, narrowed, searchOf, sortOf, sorted, tabOf } from "./inbox-lead-filter.policy"
import type { InboxLeadRow } from "./inbox-leads.contracts"

const POLICY = Symbol("./inbox-lead-filter.policy")
type PolicySubject = {
    countsOf: typeof countsOf
    inTab: typeof inTab
    matchesSearch: typeof matchesSearch
    narrowed: typeof narrowed
    searchOf: typeof searchOf
    sortOf: typeof sortOf
    sorted: typeof sorted
    tabOf: typeof tabOf
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: POLICY,
                useValue: { countsOf, inTab, matchesSearch, narrowed, searchOf, sortOf, sorted, tabOf },
            },
        ],
    }).compile()
    const subject = moduleRef.get<PolicySubject>(POLICY)
    return { subject }
}

const row = (over: Partial<InboxLeadRow>): InboxLeadRow => ({
    id: "l1",
    name: "An",
    channel: "zalo",
    via: null,
    stage: "new",
    chips: ["new"],
    summary: "roses",
    lastAt: "2026-11-09T07:00:00.000Z",
    firstAt: "2026-11-09T07:00:00.000Z",
    needsOwner: false,
    agentId: null,
    agentName: null,
    agentAvatarUrl: null,
    amountVnd: null,
    eventCount: 1,
    isUnmatched: false,
    ...over,
})

describe("inbox lead filter", () => {
    it("counts every tab over the same rows", async () => {
        const { subject } = await buildSubject()
        const { countsOf } = subject
        const rows = [
            row({ id: "a" }),
            row({ id: "b", stage: "ordered", amountVnd: 2000 }),
            row({ id: "c", stage: "paid", amountVnd: 5000 }),
            row({ id: "d", stage: "new", needsOwner: true }),
            row({ id: "e", stage: "paid", isUnmatched: true, amountVnd: 1000 }),
        ]
        expect(countsOf(rows)).toEqual({ all: 5, new: 2, needsYou: 1, ordered: 2, paid: 2 })
    })

    it("keeps a closed lead under has-order only when it carries a value", async () => {
        const { subject } = await buildSubject()
        const { inTab } = subject
        expect(inTab(row({ stage: "done", amountVnd: 1 }), "ordered")).toBe(true)
        expect(inTab(row({ stage: "done" }), "ordered")).toBe(false)
    })

    it("keeps a closed lead without a value out of the money tab", async () => {
        const { subject } = await buildSubject()
        const { inTab } = subject
        expect(inTab(row({ stage: "done" }), "paid")).toBe(false)
        expect(inTab(row({ stage: "done", amountVnd: 1 }), "paid")).toBe(true)
        expect(inTab(row({ stage: "paid", isUnmatched: true }), "ordered")).toBe(false)
    })

    it("reads the words of the tab, the order and the search, with a fallback for any other word", async () => {
        const { subject } = await buildSubject()
        const { tabOf, sortOf, searchOf } = subject

        expect(tabOf("paid")).toBe("paid")
        expect(tabOf("zzz")).toBe("all")
        expect(sortOf("amount")).toBe("amount")
        expect(sortOf("zzz")).toBe("recent")
        expect(searchOf("  cam ")).toBe("cam")
        expect(searchOf("   ")).toBeNull()
        expect(searchOf(null)).toBeNull()
    })

    it("breaks a tie of name or value by the newest first", async () => {
        const { subject } = await buildSubject()
        const { sorted } = subject
        const rows = [
            row({ id: "a", name: "A", lastAt: "2026-11-09T01:00:00.000Z", amountVnd: 10 }),
            row({ id: "b", name: "A", lastAt: "2026-11-09T02:00:00.000Z", amountVnd: 10 }),
            row({ id: "c", name: "A", lastAt: "2026-11-09T03:00:00.000Z" }),
            row({ id: "d", name: "A", lastAt: "2026-11-09T00:00:00.000Z" }),
        ]

        expect(sorted(rows, "name").map((one) => one.id)).toEqual(["c", "b", "a", "d"])
        expect(sorted(rows, "amount").map((one) => one.id)).toEqual(["b", "a", "c", "d"])
    })
})

describe("inbox lead filter narrowing and order", () => {
    it("narrows by channel and agent", async () => {
        const { subject } = await buildSubject()
        const { narrowed } = subject
        const rows = [row({ id: "a", agentId: "x" }), row({ id: "b", channel: "website", agentId: "y" })]
        expect(narrowed(rows, "website", null).map((one) => one.id)).toEqual(["b"])
        expect(narrowed(rows, null, "x").map((one) => one.id)).toEqual(["a"])
    })

    it("searches every word in the name and the words, ignoring case", async () => {
        const { subject } = await buildSubject()
        const { matchesSearch } = subject
        expect(matchesSearch(row({ name: "Tran Cam", summary: "Bo hong mini" }), "cam hong")).toBe(true)
        expect(matchesSearch(row({ name: "Tran Cam" }), "xyz")).toBe(false)
        expect(matchesSearch(row({}), null)).toBe(true)
    })

    it("sorts newest first by default, then oldest, name and value", async () => {
        const { subject } = await buildSubject()
        const { sorted } = subject
        const rows = [
            row({ id: "a", name: "B", lastAt: "2026-11-09T01:00:00.000Z", amountVnd: 10 }),
            row({ id: "b", name: "A", lastAt: "2026-11-09T02:00:00.000Z", amountVnd: 20 }),
        ]
        expect(sorted(rows, "recent").map((one) => one.id)).toEqual(["b", "a"])
        expect(sorted(rows, "oldest").map((one) => one.id)).toEqual(["a", "b"])
        expect(sorted(rows, "name").map((one) => one.id)).toEqual(["b", "a"])
        expect(sorted(rows, "amount").map((one) => one.id)).toEqual(["b", "a"])
    })
})
