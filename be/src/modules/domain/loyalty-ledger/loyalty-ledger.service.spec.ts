import { Test } from "@nestjs/testing"
import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LoyaltyLedgerErrorCode } from "./errors/loyalty-ledger.error"
import type { PostParams } from "./loyalty-ledger.contracts"
import { LoyaltyLedgerService } from "./loyalty-ledger.service"
import {
    COUNT_REDEEMED,
    INSERT_ENTRY,
    LOCK_CUSTOMER,
    SELECT_BALANCE,
    SELECT_ENTRY_BY_REF,
    SELECT_EXPIRY_ENTRIES,
    SELECT_MEMBER,
    SELECT_MEMBERS,
    SELECT_TIMELINE,
    SELECT_TOTALS_SINCE,
} from "./persistence/loyalty-ledger.sql"

const MEMBER_ROW = {
    id: "c1",
    name: "Mai",
    phone: "84912345678",
    email: null,
    birthday: null,
    tier_key: "bac",
    joined_at: new Date("2026-10-01T00:00:00.000Z"),
    note: "",
    points: 120,
    lifetime_spend_vnd: 500000,
    visits: 3,
    last_visit_at: new Date("2026-10-10T00:00:00.000Z"),
}
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

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [LoyaltyLedgerService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(LoyaltyLedgerService)
}

describe("LoyaltyLedgerService", () => {
    describe("post", () => {
        it("locks the customer, checks the key and writes the entry", async () => {
            const manager = mockEntityManager({
                query: [
                    [LOCK_CUSTOMER, [{ id: "c1" }]],
                    [SELECT_ENTRY_BY_REF, []],
                    [INSERT_ENTRY, [{ id: "e1" }]],
                ],
            })
            const ledger = await build(mockEntityManager())

            await expect(ledger.post(postOf(manager))).resolves.toBe("e1")

            expect(manager.query).toHaveBeenCalledWith(LOCK_CUSTOMER, ["c1", "ws-1"])
            expect(manager.query).toHaveBeenCalledWith(INSERT_ENTRY, [
                "ws-1",
                "c1",
                "earn",
                50,
                "order:1",
                "NIVO",
                50000,
                "o1",
                null,
                null,
                "note",
                null,
                "2026-10-12T00:00:00.000Z",
            ])
            expect(manager.query).not.toHaveBeenCalledWith(SELECT_BALANCE, expect.anything())
        })

        it("changes nothing when the key was posted before", async () => {
            const manager = mockEntityManager({
                query: [
                    [LOCK_CUSTOMER, [{ id: "c1" }]],
                    [SELECT_ENTRY_BY_REF, [{ id: "e0" }]],
                ],
            })
            const ledger = await build(mockEntityManager())

            await expect(ledger.post(postOf(manager))).resolves.toBeNull()
        })

        it("refuses a customer the workspace does not have", async () => {
            const manager = mockEntityManager({ query: [LOCK_CUSTOMER, []] })
            const ledger = await build(mockEntityManager())

            await expect(ledger.post(postOf(manager))).rejects.toMatchObject({
                code: LoyaltyLedgerErrorCode.CustomerNotFound,
            })
        })

        it("takes points only up to the balance", async () => {
            const ok = mockEntityManager({
                query: [
                    [LOCK_CUSTOMER, [{ id: "c1" }]],
                    [SELECT_ENTRY_BY_REF, []],
                    [SELECT_BALANCE, [{ points: 100 }]],
                    [INSERT_ENTRY, [{ id: "e2" }]],
                ],
            })
            const short = mockEntityManager({
                query: [
                    [LOCK_CUSTOMER, [{ id: "c1" }]],
                    [SELECT_ENTRY_BY_REF, []],
                    [SELECT_BALANCE, [{ points: 10 }]],
                ],
            })
            const ledger = await build(mockEntityManager())

            await expect(ledger.post({ ...postOf(ok), kind: "redeem", points: -100 })).resolves.toBe("e2")
            await expect(ledger.post({ ...postOf(short), kind: "redeem", points: -100 })).rejects.toMatchObject({
                code: LoyaltyLedgerErrorCode.InsufficientPoints,
            })
        })

        it("fails when the insert answers no row", async () => {
            const manager = mockEntityManager({
                query: [
                    [LOCK_CUSTOMER, [{ id: "c1" }]],
                    [SELECT_ENTRY_BY_REF, []],
                    [INSERT_ENTRY, []],
                ],
            })
            const ledger = await build(mockEntityManager())

            await expect(ledger.post(postOf(manager))).rejects.toMatchObject({ code: LoyaltyLedgerErrorCode.NotPosted })
        })
    })

    describe("hasRef", () => {
        it("tells whether a key was posted before", async () => {
            const posted = await build(mockEntityManager({ query: [SELECT_ENTRY_BY_REF, [{ id: "e0" }]] }))
            const fresh = await build(mockEntityManager({ query: [SELECT_ENTRY_BY_REF, []] }))

            await expect(posted.hasRef("ws-1", "order:1")).resolves.toBe(true)
            await expect(fresh.hasRef("ws-1", "order:1")).resolves.toBe(false)
        })
    })

    describe("reads", () => {
        it("lists the members and finds one", async () => {
            const ledger = await build(
                mockEntityManager({
                    query: [
                        [SELECT_MEMBERS, [MEMBER_ROW, { ...MEMBER_ROW, last_visit_at: null }]],
                        [SELECT_MEMBER, [MEMBER_ROW]],
                    ],
                }),
            )

            await expect(ledger.members("ws-1")).resolves.toEqual([MEMBER, { ...MEMBER, lastVisitAt: null }])
            await expect(ledger.member("ws-1", "c1")).resolves.toEqual(MEMBER)
        })

        it("answers null for a member that is not there", async () => {
            const ledger = await build(mockEntityManager({ query: [SELECT_MEMBER, []] }))

            await expect(ledger.member("ws-1", "zzz")).resolves.toBeNull()
        })

        it("reads the timeline of a customer", async () => {
            const row = {
                id: "e1",
                customer_id: "c1",
                kind: "earn",
                points: 50,
                amount_vnd: 50000,
                order_id: "o1",
                ref: "order:1",
                by_name: "NIVO",
                evidence: "note",
                reward_id: null,
                work_item_id: null,
                expires_at: new Date("2027-10-12T00:00:00.000Z"),
                occurred_at: new Date("2026-10-12T00:00:00.000Z"),
            }
            const ledger = await build(
                mockEntityManager({ query: [SELECT_TIMELINE, [row, { ...row, expires_at: null }]] }),
            )

            const [first, second] = await ledger.timeline("ws-1", "c1", 200)

            expect(first).toMatchObject({
                id: "e1",
                by: "NIVO",
                expiresAt: "2027-10-12T00:00:00.000Z",
                occurredAt: "2026-10-12T00:00:00.000Z",
            })
            expect(second).toMatchObject({ expiresAt: null })
        })

        it("counts redemptions per reward, reads the expiry entries and sums the totals", async () => {
            const ledger = await build(
                mockEntityManager({
                    query: [
                        [COUNT_REDEEMED, [{ reward_id: "r1", total: 2 }]],
                        [
                            SELECT_EXPIRY_ENTRIES,
                            [
                                { kind: "earn", points: 10, expires_at: new Date("2027-01-01T00:00:00.000Z") },
                                { kind: "redeem", points: -5, expires_at: null },
                            ],
                        ],
                        [SELECT_TOTALS_SINCE, [{ kind: "earn", entries: 3, points: 90, amount_vnd: 90000 }]],
                    ],
                }),
            )

            await expect(ledger.redeemedCounts("c1")).resolves.toEqual(new Map([["r1", 2]]))
            await expect(ledger.expiryEntries("c1")).resolves.toEqual([
                { kind: "earn", points: 10, expiresAt: "2027-01-01T00:00:00.000Z" },
                { kind: "redeem", points: -5, expiresAt: null },
            ])
            await expect(ledger.totalsSince("ws-1", "2026-09-12T00:00:00.000Z")).resolves.toEqual([
                { kind: "earn", entries: 3, points: 90, amountVnd: 90000 },
            ])
        })
    })
})
