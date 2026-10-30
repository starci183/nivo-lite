import { Test } from "@nestjs/testing"
import { In } from "typeorm"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { LeadReadService } from "@modules/domain/leads"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { FakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { LoyaltyCustomersService } from "./loyalty-customers.service"
import { LoyaltyCustomerEntity } from "./persistence/entities"

const ROW = builder<LoyaltyCustomerEntity>({
    id: "c1",
    workspaceId: "ws-1",
    name: "Mai",
    phone: "84912345678",
    email: null,
    birthday: "1990-05-01",
    tierKey: "bac",
    tierSince: null,
    joinedAt: new Date("2026-10-01T00:00:00.000Z"),
    note: "vip",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    updatedAt: new Date("2026-10-01T00:00:00.000Z"),
})()

const PERSON = { workspaceId: "ws-1", name: "Mai", phone: "84912345678", email: null, birthday: null }

const move = (manager: MockEntityManager) => ({
    manager,
    workspaceId: "ws-1",
    customerId: "c1",
    toKey: "bac",
    fromKey: null,
    nowIso: "2026-10-12T00:00:00.000Z",
})

const leadReads = mock<LeadReadService>()

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            LoyaltyCustomersService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: LeadReadService, useValue: leadReads },
        ],
    }).compile()
    return moduleRef.get(LoyaltyCustomersService)
}

/** An update's `set` argument that stamps the save time with the database clock. */
const hasClock = (value: unknown): value is { readonly updatedAt: () => string } =>
    typeof value === "object" && value !== null && "updatedAt" in value && typeof value.updatedAt === "function"

/** What an update query builder was told to set, without the always-present save time. */
const setOf = (fake: FakeQueryBuilder | undefined): object => {
    const [set] = fake?.callsOf("set")[0] ?? []
    expect(hasClock(set)).toBe(true)
    if (!hasClock(set)) return {}
    expect(set.updatedAt()).toBe("now()")
    return { ...set, updatedAt: undefined }
}

const registerByPhoneAndById = () => {
    describe("byPhone and byId", () => {
        it("answers the customer a row holds", async () => {
            const em = mockEntityManager({ findOne: [LoyaltyCustomerEntity, ROW] })
            const customers = await build(em)
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
            expect(em.findOne).toHaveBeenNthCalledWith(1, LoyaltyCustomerEntity, {
                where: { workspaceId: "ws-1", phone: "84912345678" },
            })
            expect(em.findOne).toHaveBeenNthCalledWith(2, LoyaltyCustomerEntity, {
                where: { workspaceId: "ws-1", id: "c1" },
            })
        })

        it("answers null when nobody matches", async () => {
            const customers = await build(mockEntityManager({ findOne: [LoyaltyCustomerEntity, null] }))

            await expect(customers.byPhone("ws-1", "84900000000")).resolves.toBeNull()
            await expect(customers.byId("ws-1", "zzz")).resolves.toBeNull()
        })
    })
}

const registerEnsureByPhone = () => {
    describe("ensureByPhone", () => {
        it("answers the customer the phone already belongs to", async () => {
            const manager = mockEntityManager({ findOne: [LoyaltyCustomerEntity, ROW] })
            const customers = await build(mockEntityManager())

            await expect(customers.ensureByPhone(manager, PERSON)).resolves.toBe("c1")
            expect(manager.createQueryBuilder).not.toHaveBeenCalled()
        })

        it("creates the customer of a new phone", async () => {
            const manager = mockEntityManager({ findOne: [LoyaltyCustomerEntity, null] })
            const [insert] = queueQueryBuilders(manager, [{ execute: { raw: [{ id: "c2" }] } }])
            const customers = await build(mockEntityManager())

            await expect(customers.ensureByPhone(manager, PERSON)).resolves.toBe("c2")
            expect(insert?.callsOf("values")).toEqual([
                [{ workspaceId: "ws-1", name: "Mai", phone: "84912345678", email: null }],
            ])
            expect(insert?.callsOf("orIgnore")).toHaveLength(1)
            expect(insert?.callsOf("returning")).toEqual([["id"]])
        })

        it("finds the customer a concurrent request created first", async () => {
            const manager = mockEntityManager({
                findOne: [
                    [LoyaltyCustomerEntity, null],
                    [LoyaltyCustomerEntity, ROW],
                ],
            })
            queueQueryBuilders(manager, [{ execute: { raw: [] } }])
            const customers = await build(mockEntityManager())

            await expect(customers.ensureByPhone(manager, PERSON)).resolves.toBe("c1")
        })

        it("answers null when the insert lost the race and nobody can be found", async () => {
            const manager = mockEntityManager({ findOne: [LoyaltyCustomerEntity, null] })
            queueQueryBuilders(manager, [{ execute: { raw: [] } }])
            const customers = await build(mockEntityManager())

            await expect(customers.ensureByPhone(manager, PERSON)).resolves.toBeNull()
        })

        it("looks nobody up by a missing phone, a null never matching a row", async () => {
            const manager = mockEntityManager()
            queueQueryBuilders(manager, [{ execute: { raw: [{ id: "c3" }] } }])
            const customers = await build(mockEntityManager())

            await expect(customers.ensureByPhone(manager, { ...PERSON, phone: null })).resolves.toBe("c3")
            expect(manager.findOne).not.toHaveBeenCalled()
        })

        it("reads rows the driver did not answer as not created, and skips rows without an id", async () => {
            const missing = mockEntityManager({ findOne: [LoyaltyCustomerEntity, null] })
            queueQueryBuilders(missing, [{ execute: { raw: "no rows" } }])
            const odd = mockEntityManager({ findOne: [LoyaltyCustomerEntity, null] })
            queueQueryBuilders(odd, [{ execute: { raw: [null, 7, {}, { id: 3 }] } }])
            const customers = await build(mockEntityManager())

            await expect(customers.ensureByPhone(missing, PERSON)).resolves.toBeNull()
            await expect(customers.ensureByPhone(odd, PERSON)).resolves.toBeNull()
        })
    })
}

const registerMoveTier = () => {
    describe("moveTier", () => {
        it("is true when this call moved the customer and false when somebody did first", async () => {
            const moved = mockEntityManager()
            const lost = mockEntityManager()
            const [update] = queueQueryBuilders(moved, [{ execute: { raw: [{ id: "c1" }] } }])
            queueQueryBuilders(lost, [{ execute: { raw: [] } }])
            const customers = await build(mockEntityManager())

            await expect(customers.moveTier(move(moved))).resolves.toBe(true)
            await expect(customers.moveTier(move(lost))).resolves.toBe(false)
            const at = new Date("2026-10-12T00:00:00.000Z")
            expect(update?.callsOf("set")).toEqual([[{ tierKey: "bac", tierSince: at, updatedAt: at }]])
            expect(update?.callsOf("where")).toEqual([
                [
                    "workspace_id = :workspaceId AND id = :customerId AND tier_key IS NOT DISTINCT FROM :fromKey",
                    { workspaceId: "ws-1", customerId: "c1", fromKey: null },
                ],
            ])
        })
    })
}

const registerLeadContacts = () => {
    describe("leadContacts and contactsMatching", () => {
        it("keeps the leads with a usable phone or email, normalised", async () => {
            leadReads.listContacts.mockResolvedValue([
                { id: "l1", contact_name: "A", phone: "0912 345 678", email: null },
                { id: "l2", contact_name: "B", phone: null, email: "B@X.COM" },
                { id: "l3", contact_name: "C", phone: "12", email: "nope" },
            ])
            const customers = await build(mockEntityManager())

            await expect(customers.leadContacts("ws-1")).resolves.toEqual([
                { id: "l1", name: "A", phone: "84912345678", email: null },
                { id: "l2", name: "B", phone: null, email: "b@x.com" },
            ])
            expect(leadReads.listContacts).toHaveBeenCalledWith("ws-1", 2000)
        })

        it("finds the customers behind a set of phones and emails", async () => {
            const manager = mockEntityManager({
                find: [LoyaltyCustomerEntity, [{ ...ROW, email: null }]],
            })
            const customers = await build(mockEntityManager())

            await expect(
                customers.contactsMatching(manager, "ws-1", { phones: ["84912345678"], emails: ["a@x.com"] }, 4),
            ).resolves.toEqual([{ id: "c1", phone: "84912345678", email: null }])
            expect(manager.find).toHaveBeenCalledWith(LoyaltyCustomerEntity, {
                select: { id: true, phone: true, email: true },
                where: [
                    { workspaceId: "ws-1", phone: In(["84912345678"]) },
                    { workspaceId: "ws-1", email: In(["a@x.com"]) },
                ],
                take: 4,
            })
        })

        it("finds nobody for an empty set of contacts, and reads only the side that is given", async () => {
            const manager = mockEntityManager({ find: [LoyaltyCustomerEntity, []] })
            const customers = await build(mockEntityManager())

            await expect(customers.contactsMatching(manager, "ws-1", { phones: [], emails: [] }, 4)).resolves.toEqual(
                [],
            )
            expect(manager.find).not.toHaveBeenCalled()
            await customers.contactsMatching(manager, "ws-1", { phones: [], emails: ["a@x.com"] }, 4)
            expect(manager.find).toHaveBeenCalledWith(
                LoyaltyCustomerEntity,
                expect.objectContaining({ where: [{ workspaceId: "ws-1", email: In(["a@x.com"]) }] }),
            )
        })
    })
}

const registerCreateFromLeads = () => {
    describe("createFromLeads", () => {
        it("creates the customers of leads in one statement and counts them", async () => {
            const manager = mockEntityManager()
            const [insert] = queueQueryBuilders(manager, [{ execute: { raw: [{ id: "c1" }, { id: "c2" }] } }])
            const customers = await build(mockEntityManager())

            await expect(
                customers.createFromLeads(manager, "ws-1", [
                    { id: "l1", name: "A", phone: "84912345678", email: null },
                    { id: "l2", name: "B", phone: null, email: "b@x.com" },
                ]),
            ).resolves.toBe(2)
            expect(insert?.callsOf("values")).toEqual([
                [
                    [
                        { workspaceId: "ws-1", name: "A", phone: "84912345678", email: null },
                        { workspaceId: "ws-1", name: "B", phone: null, email: "b@x.com" },
                    ],
                ],
            ])
            expect(insert?.callsOf("orIgnore")).toHaveLength(1)
        })

        it("writes nothing for no leads", async () => {
            const manager = mockEntityManager()
            const customers = await build(mockEntityManager())

            await expect(customers.createFromLeads(manager, "ws-1", [])).resolves.toBe(0)
            expect(manager.createQueryBuilder).not.toHaveBeenCalled()
        })
    })
}

const registerUpdateProfile = () => {
    describe("updateProfile", () => {
        it("trims and bounds profile fields and saves a valid birthday", async () => {
            const manager = mockEntityManager()
            const [update] = queueQueryBuilders(manager, [{ execute: { raw: [{ id: "c1" }] } }])
            const customers = await build(manager)

            await expect(
                customers.updateProfile("ws-1", "c1", {
                    name: `  ${"M".repeat(121)}  `,
                    birthday: "1990-05-01",
                    note: `  ${"N".repeat(501)}  `,
                }),
            ).resolves.toBe(true)
            expect(setOf(update)).toEqual({
                name: "M".repeat(120),
                birthday: "1990-05-01",
                note: "N".repeat(500),
                updatedAt: undefined,
            })
            expect(update?.callsOf("where")).toEqual([
                ["workspace_id = :workspaceId AND id = :customerId", { workspaceId: "ws-1", customerId: "c1" }],
            ])
        })

        it("leaves omitted fields untouched and reports an unmatched customer", async () => {
            const manager = mockEntityManager()
            const [update] = queueQueryBuilders(manager, [{ execute: { raw: [] } }])
            const customers = await build(manager)

            await expect(customers.updateProfile("ws-1", "missing", {})).resolves.toBe(false)
            expect(setOf(update)).toEqual({ updatedAt: undefined })
        })

        it("keeps a blank name and explicitly clears the birthday and note", async () => {
            const manager = mockEntityManager()
            const [update] = queueQueryBuilders(manager, [{ execute: { raw: [{ id: "c1" }] } }])
            const customers = await build(manager)

            await expect(
                customers.updateProfile("ws-1", "c1", { name: "  ", birthday: null, note: "  " }),
            ).resolves.toBe(true)
            expect(setOf(update)).toEqual({ birthday: null, note: "", updatedAt: undefined })
        })

        it("turns an invalid birthday into an explicit clear", async () => {
            const manager = mockEntityManager()
            const [update] = queueQueryBuilders(manager, [{ execute: { raw: [{ id: "c1" }] } }])
            const customers = await build(manager)

            await expect(customers.updateProfile("ws-1", "c1", { birthday: "2025-02-29" })).resolves.toBe(true)
            expect(setOf(update)).toEqual({ birthday: null, updatedAt: undefined })
        })
    })
}

const registerListAndLock = () => {
    describe("listNewest and lockOwn", () => {
        it("lists the newest customers of the workspace as contract customers", async () => {
            const em = mockEntityManager({ find: [LoyaltyCustomerEntity, [ROW]] })
            const customers = await build(em)

            await expect(customers.listNewest("ws-1", 5)).resolves.toMatchObject([{ id: "c1", name: "Mai" }])
            expect(em.find).toHaveBeenCalledWith(LoyaltyCustomerEntity, {
                where: { workspaceId: "ws-1" },
                order: { createdAt: "DESC", id: "DESC" },
                take: 5,
            })
        })

        it("locks a customer of the workspace for writing, or reports that there is none", async () => {
            const manager = mockEntityManager({ findOne: [LoyaltyCustomerEntity, ROW] })
            const customers = await build(mockEntityManager())

            await expect(customers.lockOwn(manager, "ws-1", "c1")).resolves.toBe(true)
            expect(manager.findOne).toHaveBeenCalledWith(LoyaltyCustomerEntity, {
                select: { id: true },
                where: { workspaceId: "ws-1", id: "c1" },
                lock: { mode: "pessimistic_write" },
            })
            const empty = mockEntityManager({ findOne: [LoyaltyCustomerEntity, null] })
            await expect(customers.lockOwn(empty, "ws-1", "zzz")).resolves.toBe(false)
        })
    })
}

describe("LoyaltyCustomersService", () => {
    registerListAndLock()
    registerByPhoneAndById()
    registerEnsureByPhone()
    registerMoveTier()
    registerLeadContacts()
    registerCreateFromLeads()
    registerUpdateProfile()
})
