import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { LoyaltyCustomersService } from "@modules/domain/loyalty-customers"
import type { LoyaltyCustomer } from "@modules/domain/loyalty-customers"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { LoyaltyLedgerErrorCode } from "./errors/loyalty-ledger.error"
import type { PostParams } from "./loyalty-ledger.contracts"
import { LoyaltyLedgerService } from "./loyalty-ledger.service"
import { LoyaltyLedgerEntity } from "./persistence/entities"
import type { BalanceRaw } from "./policies/ledger.mapper"

const CUSTOMER: LoyaltyCustomer = {
    id: "c1",
    name: "Mai",
    phone: "84912345678",
    email: null,
    birthday: null,
    tierKey: "bac",
    joinedAt: "2026-10-01T00:00:00.000Z",
    note: "",
}
const balanceRowOf = builder<BalanceRaw>({
    customer_id: "c1",
    points: 120,
    lifetime_spend_vnd: 500000,
    visits: 3,
    last_visit_at: new Date("2026-10-10T00:00:00.000Z"),
})
const MEMBER = {
    id: "c1",
    name: "Mai",
    phone: "84912345678",
    email: null,
    birthday: null,
    tierKey: "bac",
    points: 120,
    lifetimeSpendVnd: 500000,
    visits: 3,
    lastVisitAt: "2026-10-10T00:00:00.000Z",
    joinedAt: "2026-10-01T00:00:00.000Z",
    note: "",
}
const entryOf = builder<LoyaltyLedgerEntity>({
    id: "e1",
    workspaceId: "ws-1",
    customerId: "c1",
    kind: "earn",
    points: 50,
    amountVnd: 50000,
    orderId: "o1",
    invoiceId: null,
    rewardId: null,
    workItemId: null,
    ref: "order:1",
    byName: "NIVO",
    evidence: "note",
    expiresAt: new Date("2027-10-12T00:00:00.000Z"),
    occurredAt: new Date("2026-10-12T00:00:00.000Z"),
    createdAt: new Date("2026-10-12T00:00:00.000Z"),
})
const postOf = (manager: MockEntityManager) =>
    builder<PostParams>({
        manager,
        workspaceId: "ws-1",
        customerId: "c1",
        kind: "earn",
        points: 50,
        ref: "order:1",
        by: "NIVO",
        amountVnd: 50000,
        orderId: "o1",
        invoiceId: null,
        rewardId: null,
        evidence: "note",
        expiresAt: null,
        occurredAt: "2026-10-12T00:00:00.000Z",
    })()

const customerReads = mock<LoyaltyCustomersService>()

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            LoyaltyLedgerService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: LoyaltyCustomersService, useValue: customerReads },
        ],
    }).compile()
    return moduleRef.get(LoyaltyLedgerService)
}

/** What the reads and the insert of a posting answer. */
interface PostingAnswers {
    /** The answer of the customer lock. */
    readonly locked: unknown
    /** Whether the key was posted before. */
    readonly posted?: boolean
    /** The answer of the insert. */
    readonly inserted?: object
}

/** Hands a literal to an expectation as a plain object, so it is not mistaken for a hand-built entity row. */
const plain = (value: object): object => value

/** A transaction manager whose lock read answers `locked`, whose key check answers `posted` and whose balance read answers `balance`. */
const postingManager = (answers: PostingAnswers, balance: unknown = undefined) => {
    const manager = mockEntityManager({
        exists: [LoyaltyLedgerEntity, answers.posted ?? false],
        insert: [LoyaltyLedgerEntity, answers.inserted ?? { identifiers: [{ id: "e1" }] }],
    })
    const [sum] = queueQueryBuilders(manager, [{ getRawOne: balance }])
    customerReads.lockOwn.mockResolvedValue(answers.locked !== undefined)
    return { manager, sum }
}

describe("LoyaltyLedgerService post", () => {
    it("locks the customer, checks the key and writes the entry", async () => {
        const { manager, sum } = postingManager({ locked: { id: "c1" } })
        const ledger = await build(mockEntityManager())

        await expect(ledger.post(postOf(manager))).resolves.toBe("e1")

        expect(customerReads.lockOwn).toHaveBeenCalledWith(manager, "ws-1", "c1")
        expect(manager.exists).toHaveBeenCalledWith(LoyaltyLedgerEntity, {
            where: { workspaceId: "ws-1", ref: "order:1" },
        })
        expect(manager.insert.mock.calls).toEqual([
            [
                LoyaltyLedgerEntity,
                plain({
                    workspaceId: "ws-1",
                    customerId: "c1",
                    kind: "earn",
                    points: 50,
                    ref: "order:1",
                    byName: "NIVO",
                    amountVnd: 50000,
                    orderId: "o1",
                    invoiceId: null,
                    rewardId: null,
                    evidence: "note",
                    expiresAt: null,
                    occurredAt: new Date("2026-10-12T00:00:00.000Z"),
                }),
            ],
        ])
        expect(sum?.calls).toEqual([])
    })

    it("names an empty author NIVO and keeps the expiry of an earn", async () => {
        const { manager } = postingManager({ locked: { id: "c1" } })
        const ledger = await build(mockEntityManager())

        await ledger.post({ ...postOf(manager), by: "", expiresAt: "2027-10-12T00:00:00.000Z" })

        expect(manager.insert.mock.calls[0]?.[1]).toMatchObject({
            byName: "NIVO",
            expiresAt: new Date("2027-10-12T00:00:00.000Z"),
        })
    })

    it("changes nothing when the key was posted before", async () => {
        const { manager } = postingManager({ locked: { id: "c1" }, posted: true })
        const ledger = await build(mockEntityManager())

        await expect(ledger.post(postOf(manager))).resolves.toBeNull()
        expect(manager.insert).not.toHaveBeenCalled()
    })

    it("refuses a customer the workspace does not have", async () => {
        const { manager } = postingManager({ locked: undefined })
        const ledger = await build(mockEntityManager())

        await expect(ledger.post(postOf(manager))).rejects.toMatchObject({
            code: LoyaltyLedgerErrorCode.CustomerNotFound,
        })
        expect(manager.exists).not.toHaveBeenCalled()
    })
})

describe("LoyaltyLedgerService post balance", () => {
    it("takes points only up to the balance", async () => {
        const enough = postingManager(
            { locked: { id: "c1" }, inserted: { identifiers: [{ id: "e2" }] } },
            { points: 100 },
        )
        const short = postingManager({ locked: { id: "c1" } }, { points: 10 })
        const ledger = await build(mockEntityManager())

        await expect(ledger.post({ ...postOf(enough.manager), kind: "redeem", points: -100 })).resolves.toBe("e2")
        await expect(ledger.post({ ...postOf(short.manager), kind: "redeem", points: -100 })).rejects.toMatchObject({
            code: LoyaltyLedgerErrorCode.InsufficientPoints,
        })
        expect(enough.sum?.callsOf("where")).toEqual([["l.customerId = :customerId", { customerId: "c1" }]])
        expect(short.manager.insert).not.toHaveBeenCalled()
    })

    it("counts a customer with no entries as holding nothing", async () => {
        const { manager } = postingManager({ locked: { id: "c1" } }, undefined)
        const ledger = await build(mockEntityManager())

        await expect(ledger.post({ ...postOf(manager), kind: "adjust", points: -1 })).rejects.toMatchObject({
            code: LoyaltyLedgerErrorCode.InsufficientPoints,
        })
    })

    it("fails when the insert answers no row", async () => {
        const { manager } = postingManager({ locked: { id: "c1" }, inserted: { identifiers: [] } })
        const ledger = await build(mockEntityManager())

        await expect(ledger.post(postOf(manager))).rejects.toMatchObject({ code: LoyaltyLedgerErrorCode.NotPosted })
    })
})

describe("LoyaltyLedgerService rewardUsed", () => {
    it("tells whether an entry refers to the reward", async () => {
        const em = mockEntityManager({ exists: [LoyaltyLedgerEntity, true] })
        const ledger = await build(em)

        await expect(ledger.rewardUsed("r1")).resolves.toBe(true)
        expect(em.exists).toHaveBeenCalledWith(LoyaltyLedgerEntity, { where: { rewardId: "r1" } })
    })
})

describe("LoyaltyLedgerService hasRef", () => {
    it("tells whether a key was posted before", async () => {
        const posted = await build(mockEntityManager({ exists: [LoyaltyLedgerEntity, true] }))
        const fresh = await build(mockEntityManager({ exists: [LoyaltyLedgerEntity, false] }))

        await expect(posted.hasRef("ws-1", "order:1")).resolves.toBe(true)
        await expect(fresh.hasRef("ws-1", "order:1")).resolves.toBe(false)
    })
})

describe("LoyaltyLedgerService members", () => {
    it("lists the members, newest first, with the balances of the ledger", async () => {
        const em = mockEntityManager()
        const [balances] = queueQueryBuilders(em, [
            { getRawMany: [balanceRowOf(), balanceRowOf({ customer_id: "c2", last_visit_at: null })] },
        ])
        customerReads.listNewest.mockResolvedValue([CUSTOMER, { ...CUSTOMER, id: "c2" }, { ...CUSTOMER, id: "c3" }])
        const ledger = await build(em)

        await expect(ledger.members("ws-1")).resolves.toEqual([
            MEMBER,
            { ...MEMBER, id: "c2", lastVisitAt: null },
            { ...MEMBER, id: "c3", points: 0, lifetimeSpendVnd: 0, visits: 0, lastVisitAt: null },
        ])
        expect(customerReads.listNewest).toHaveBeenCalledWith("ws-1", 2000)
        expect(balances?.callsOf("groupBy")).toEqual([["l.customerId"]])
        expect(balances?.callsOf("where")[0]?.[1]).toEqual({ workspaceId: "ws-1", customerIds: ["c1", "c2", "c3"] })
    })

    it("reads no balances when the workspace has no customers", async () => {
        const em = mockEntityManager()
        customerReads.listNewest.mockResolvedValue([])
        const ledger = await build(em)

        await expect(ledger.members("ws-1")).resolves.toEqual([])
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })

    it("finds one member", async () => {
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ getRawMany: [balanceRowOf()] }])
        customerReads.byId.mockResolvedValue(CUSTOMER)
        const ledger = await build(em)

        await expect(ledger.member("ws-1", "c1")).resolves.toEqual(MEMBER)
        expect(customerReads.byId).toHaveBeenCalledWith("ws-1", "c1")
    })

    it("answers null for a member that is not there", async () => {
        const em = mockEntityManager()
        customerReads.byId.mockResolvedValue(null)
        const ledger = await build(em)

        await expect(ledger.member("ws-1", "zzz")).resolves.toBeNull()
    })
})

describe("LoyaltyLedgerService timeline", () => {
    it("reads the newest entries of a customer", async () => {
        const em = mockEntityManager({
            find: [LoyaltyLedgerEntity, [entryOf(), Object.assign(entryOf(), { expiresAt: null })]],
        })
        const ledger = await build(em)

        const [first, second] = await ledger.timeline("ws-1", "c1", 200)

        expect(first).toMatchObject({
            id: "e1",
            by: "NIVO",
            expiresAt: "2027-10-12T00:00:00.000Z",
            occurredAt: "2026-10-12T00:00:00.000Z",
        })
        expect(second).toMatchObject({ expiresAt: null })
        expect(em.find.mock.calls[0]?.[1]).toEqual({
            where: { workspaceId: "ws-1", customerId: "c1" },
            order: { occurredAt: "DESC" },
            take: 200,
        })
    })
})

describe("LoyaltyLedgerService counts", () => {
    it("counts redemptions per reward, reads the expiry entries and sums the totals", async () => {
        const em = mockEntityManager({
            find: [
                LoyaltyLedgerEntity,
                [entryOf(), Object.assign(entryOf(), { kind: "redeem", points: -5, expiresAt: null })],
            ],
        })
        const [redeemed, totals] = queueQueryBuilders(em, [
            { getRawMany: [{ reward_id: "r1", total: 2 }] },
            { getRawMany: [{ kind: "earn", entries: 3, points: 90, amount_vnd: 90000 }] },
        ])
        const ledger = await build(em)

        await expect(ledger.redeemedCounts("c1")).resolves.toEqual(new Map([["r1", 2]]))
        await expect(ledger.expiryEntries("c1")).resolves.toEqual([
            { kind: "earn", points: 50, expiresAt: "2027-10-12T00:00:00.000Z" },
            { kind: "redeem", points: -5, expiresAt: null },
        ])
        await expect(ledger.totalsSince("ws-1", "2026-09-12T00:00:00.000Z")).resolves.toEqual([
            { kind: "earn", entries: 3, points: 90, amountVnd: 90000 },
        ])
        expect(redeemed?.callsOf("groupBy")).toEqual([["l.rewardId"]])
        expect(redeemed?.callsOf("limit")).toEqual([[200]])
        expect(totals?.callsOf("where")).toEqual([
            [
                "l.workspaceId = :workspaceId AND l.occurredAt >= :since",
                { workspaceId: "ws-1", since: new Date("2026-09-12T00:00:00.000Z") },
            ],
        ])
        expect(totals?.callsOf("limit")).toEqual([[4]])
        expect(em.find.mock.calls[0]?.[1]).toEqual({
            select: { kind: true, points: true, expiresAt: true },
            where: { customerId: "c1" },
            order: { occurredAt: "ASC" },
            take: 2000,
        })
    })
})
