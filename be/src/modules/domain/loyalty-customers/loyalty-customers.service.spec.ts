import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LoyaltyCustomersService } from "./loyalty-customers.service"
import {
    INSERT_CUSTOMER,
    INSERT_CUSTOMERS_FROM_LEADS,
    SELECT_CUSTOMER_BY_ID,
    SELECT_CUSTOMER_BY_PHONE,
    SELECT_LEAD_CONTACTS,
    UPDATE_CUSTOMER_TIER,
    UPDATE_CUSTOMER_PROFILE,
} from "./persistence/loyalty-customers.sql"

const ROW = {
    id: "c1",
    name: "Mai",
    phone: "84912345678",
    email: null,
    birthday: "1990-05-01",
    tier_key: "bac",
    joined_at: new Date("2026-10-01T00:00:00.000Z"),
    note: "vip",
}
const PERSON = { workspaceId: "ws-1", name: "Mai", phone: "84912345678", email: null, birthday: null }

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [LoyaltyCustomersService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(LoyaltyCustomersService)
}

describe("LoyaltyCustomersService", () => {
    describe("byPhone and byId", () => {
        it("answers the customer a row holds", async () => {
            const customers = await build(
                mockEntityManager({
                    query: [
                        [SELECT_CUSTOMER_BY_PHONE, [ROW]],
                        [SELECT_CUSTOMER_BY_ID, [ROW]],
                    ],
                }),
            )
            const expected = {
                id: "c1",
                name: "Mai",
                phone: "84912345678",
                email: null,
                birthday: "1990-05-01",
                tierKey: "bac",
                joinedAt: "2026-10-01T00:00:00.000Z",
                note: "vip",
            }

            await expect(customers.byPhone("ws-1", "84912345678")).resolves.toEqual(expected)
            await expect(customers.byId("ws-1", "c1")).resolves.toEqual(expected)
        })

        it("answers null when nobody matches", async () => {
            const customers = await build(
                mockEntityManager({
                    query: [
                        [SELECT_CUSTOMER_BY_PHONE, []],
                        [SELECT_CUSTOMER_BY_ID, []],
                    ],
                }),
            )

            await expect(customers.byPhone("ws-1", "84900000000")).resolves.toBeNull()
            await expect(customers.byId("ws-1", "zzz")).resolves.toBeNull()
        })
    })

    describe("ensureByPhone", () => {
        it("answers the customer the phone already belongs to", async () => {
            const manager = mockEntityManager({ query: [SELECT_CUSTOMER_BY_PHONE, [ROW]] })
            const customers = await build(mockEntityManager())

            await expect(customers.ensureByPhone(manager, PERSON)).resolves.toBe("c1")
            expect(manager.query).not.toHaveBeenCalledWith(INSERT_CUSTOMER, expect.anything())
        })

        it("creates the customer of a new phone", async () => {
            const manager = mockEntityManager({
                query: [
                    [SELECT_CUSTOMER_BY_PHONE, []],
                    [INSERT_CUSTOMER, [{ id: "c2" }]],
                ],
            })
            const customers = await build(mockEntityManager())

            await expect(customers.ensureByPhone(manager, PERSON)).resolves.toBe("c2")
            expect(manager.query).toHaveBeenCalledWith(INSERT_CUSTOMER, ["ws-1", "Mai", "84912345678", null])
        })

        it("finds the customer a concurrent request created first", async () => {
            const manager = mockEntityManager({
                query: [
                    [SELECT_CUSTOMER_BY_PHONE, []],
                    [SELECT_CUSTOMER_BY_PHONE, [ROW]],
                    [INSERT_CUSTOMER, []],
                ],
            })
            const customers = await build(mockEntityManager())

            await expect(customers.ensureByPhone(manager, PERSON)).resolves.toBe("c1")
        })

        it("answers null when the insert lost the race and nobody can be found", async () => {
            const manager = mockEntityManager({
                query: [
                    [SELECT_CUSTOMER_BY_PHONE, []],
                    [INSERT_CUSTOMER, []],
                ],
            })
            const customers = await build(mockEntityManager())

            await expect(customers.ensureByPhone(manager, PERSON)).resolves.toBeNull()
        })
    })

    describe("moveTier", () => {
        const move = (manager: MockEntityManager) => ({
            manager,
            workspaceId: "ws-1",
            customerId: "c1",
            toKey: "bac",
            fromKey: null,
            nowIso: "2026-10-12T00:00:00.000Z",
        })

        it("is true when this call moved the customer and false when somebody did first", async () => {
            const moved = mockEntityManager({ query: [UPDATE_CUSTOMER_TIER, [{ id: "c1" }]] })
            const lost = mockEntityManager({ query: [UPDATE_CUSTOMER_TIER, []] })
            const customers = await build(mockEntityManager())

            await expect(customers.moveTier(move(moved))).resolves.toBe(true)
            await expect(customers.moveTier(move(lost))).resolves.toBe(false)
            expect(moved.query).toHaveBeenCalledWith(UPDATE_CUSTOMER_TIER, [
                "ws-1",
                "c1",
                "bac",
                null,
                "2026-10-12T00:00:00.000Z",
            ])
        })
    })

    describe("leadContacts and createFromLeads", () => {
        it("keeps the leads with a usable phone or email, normalised", async () => {
            const customers = await build(
                mockEntityManager({
                    query: [
                        SELECT_LEAD_CONTACTS,
                        [
                            { id: "l1", contact_name: "A", phone: "0912 345 678", email: null },
                            { id: "l2", contact_name: "B", phone: null, email: "B@X.COM" },
                            { id: "l3", contact_name: "C", phone: "12", email: "nope" },
                        ],
                    ],
                }),
            )

            await expect(customers.leadContacts("ws-1")).resolves.toEqual([
                { id: "l1", name: "A", phone: "84912345678", email: null },
                { id: "l2", name: "B", phone: null, email: "b@x.com" },
            ])
        })

        it("creates the customers of leads in one statement and counts them", async () => {
            const manager = mockEntityManager({ query: [INSERT_CUSTOMERS_FROM_LEADS, [{ id: "c1" }, { id: "c2" }]] })
            const customers = await build(mockEntityManager())

            await expect(
                customers.createFromLeads(manager, "ws-1", [
                    { id: "l1", name: "A", phone: "84912345678", email: null },
                    { id: "l2", name: "B", phone: null, email: "b@x.com" },
                ]),
            ).resolves.toBe(2)
            expect(manager.query).toHaveBeenCalledWith(INSERT_CUSTOMERS_FROM_LEADS, [
                "ws-1",
                ["A", "B"],
                ["84912345678", null],
                [null, "b@x.com"],
            ])
        })

        it("writes nothing for no leads", async () => {
            const manager = mockEntityManager()
            const customers = await build(mockEntityManager())

            await expect(customers.createFromLeads(manager, "ws-1", [])).resolves.toBe(0)
        })
    })

    describe("updateProfile", () => {
        it("trims and bounds profile fields and saves a valid birthday", async () => {
            const manager = mockEntityManager({ query: [UPDATE_CUSTOMER_PROFILE, [{ id: "c1" }]] })
            const customers = await build(manager)

            await expect(
                customers.updateProfile("ws-1", "c1", {
                    name: `  ${"M".repeat(121)}  `,
                    birthday: "1990-05-01",
                    note: `  ${"N".repeat(501)}  `,
                }),
            ).resolves.toBe(true)
            expect(manager.query).toHaveBeenCalledWith(UPDATE_CUSTOMER_PROFILE, [
                "ws-1",
                "c1",
                "M".repeat(120),
                true,
                "1990-05-01",
                "N".repeat(500),
            ])
        })

        it("leaves omitted fields untouched and reports an unmatched customer", async () => {
            const manager = mockEntityManager({ query: [UPDATE_CUSTOMER_PROFILE, []] })
            const customers = await build(manager)

            await expect(customers.updateProfile("ws-1", "missing", {})).resolves.toBe(false)
            expect(manager.query).toHaveBeenCalledWith(UPDATE_CUSTOMER_PROFILE, [
                "ws-1",
                "missing",
                null,
                false,
                null,
                null,
            ])
        })

        it("keeps a blank name and explicitly clears the birthday and note", async () => {
            const manager = mockEntityManager({ query: [UPDATE_CUSTOMER_PROFILE, [{ id: "c1" }]] })
            const customers = await build(manager)

            await expect(
                customers.updateProfile("ws-1", "c1", { name: "  ", birthday: null, note: "  " }),
            ).resolves.toBe(true)
            expect(manager.query).toHaveBeenCalledWith(UPDATE_CUSTOMER_PROFILE, ["ws-1", "c1", null, true, null, ""])
        })

        it("turns an invalid birthday into an explicit clear", async () => {
            const manager = mockEntityManager({ query: [UPDATE_CUSTOMER_PROFILE, [{ id: "c1" }]] })
            const customers = await build(manager)

            await expect(customers.updateProfile("ws-1", "c1", { birthday: "2025-02-29" })).resolves.toBe(true)
            expect(manager.query).toHaveBeenCalledWith(UPDATE_CUSTOMER_PROFILE, ["ws-1", "c1", null, true, null, null])
        })
    })
})
