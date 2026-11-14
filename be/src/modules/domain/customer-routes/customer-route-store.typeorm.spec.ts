import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { ContactEntity } from "@modules/domain/contacts/persistence/entities"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { TypeormCustomerRouteStore } from "./customer-route-store.typeorm"
import { CustomerRouteEntity } from "./persistence/entities"

const WS = "11111111-1111-4111-8111-111111111111"

const build = async () => {
    const em = mockEntityManager()
    const moduleRef = await Test.createTestingModule({
        providers: [TypeormCustomerRouteStore, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { store: moduleRef.get(TypeormCustomerRouteStore), em }
}

describe("TypeormCustomerRouteStore insert", () => {
    it("writes the route through an insert-or-nothing that names its entity and answers the id this call wrote", async () => {
        const { store, em } = await build()
        const [fake] = queueQueryBuilders(em, [{ execute: { raw: [{ id: "r1" }] } }])

        await expect(store.insert(WS, { contactId: "c1", channel: "zalo", accountId: null })).resolves.toBe("r1")

        expect(em.createQueryBuilder).toHaveBeenCalledWith(CustomerRouteEntity, "route")
        expect(fake?.callsOf("orIgnore")).toHaveLength(1)
        expect(fake?.callsOf("values")[0]).toEqual([{ workspaceId: WS, contactId: "c1", channel: "zalo", accountId: null }])
    })

    it("gives the row the id it adopts, and answers null when the key or the id was taken first", async () => {
        const { store, em } = await build()
        const [fake] = queueQueryBuilders(em, [{ execute: { raw: [{ id: "chat-9" }] } }, { execute: { raw: [] } }])

        await expect(store.insert(WS, { id: "chat-9", contactId: "c1", channel: "zalo", accountId: "a1" })).resolves.toBe("chat-9")
        await expect(store.insert(WS, { id: "chat-9", contactId: "c1", channel: "zalo", accountId: "a1" })).resolves.toBeNull()

        expect(fake?.callsOf("values")[0]).toEqual([{ workspaceId: WS, id: "chat-9", contactId: "c1", channel: "zalo", accountId: "a1" }])
    })
})

describe("TypeormCustomerRouteStore reads leave out the routes of a deleted contact (soft delete, R31)", () => {
    const ROW = Object.assign(new CustomerRouteEntity(), {
        id: "r1",
        workspaceId: WS,
        contactId: "c1",
        channel: "zalo",
        accountId: null,
        createdAt: new Date("2026-11-13T10:00:00.000Z"),
    })
    const LIVE_JOIN = "contact.id = route.contactId AND contact.workspaceId = route.workspaceId AND contact.erasedAt IS NULL " +
    `AND NOT EXISTS (SELECT 1 FROM public.connections removed WHERE removed.id = route.accountId AND removed.deleted_at IS NOT NULL)`

    it("reads a route by id inside its workspace, joined to a contact that is not deleted", async () => {
        const { store, em } = await build()
        const [fake] = queueQueryBuilders(em, [{ getOne: ROW }])

        await expect(store.byId(WS, "r1")).resolves.toEqual({
            id: "r1",
            contactId: "c1",
            channel: "zalo",
            accountId: null,
            createdAt: "2026-11-13T10:00:00.000Z",
        })
        expect(fake?.callsOf("innerJoin")[0]).toEqual([ContactEntity, "contact", LIVE_JOIN])
        expect(fake?.callsOf("where")[0]).toEqual(["route.workspaceId = :workspaceId", { workspaceId: WS }])
        expect(fake?.callsOf("andWhere")[0]).toEqual(["route.id = :routeId", { routeId: "r1" }])
    })

    it("answers null for a route nobody holds (or whose contact is deleted: the join drops the row)", async () => {
        const { store, em } = await build()
        queueQueryBuilders(em, [{ getOne: null }])

        await expect(store.byId(WS, "r-of-a-deleted-contact")).resolves.toBeNull()
    })

    it("reads the oldest route of an entrance under the live-contact join, a null account as IS NULL, an account by value", async () => {
        const { store, em } = await build()
        const [open, named] = queueQueryBuilders(em, [{ getOne: ROW }, { getOne: null }])

        await expect(store.ofEntrance(WS, ["c1", "c0"], "zalo", null)).resolves.toMatchObject({ id: "r1" })
        await expect(store.ofEntrance(WS, ["c1"], "zalo", "a1")).resolves.toBeNull()

        expect(open?.callsOf("innerJoin")[0]).toEqual([ContactEntity, "contact", LIVE_JOIN])
        expect(open?.callsOf("andWhere").map((call) => call[0])).toEqual(
            expect.arrayContaining(["route.contactId IN (:...contactIds)", "route.channel = :channel", "route.accountId IS NULL"]),
        )
        expect(open?.callsOf("orderBy")[0]).toEqual(["route.createdAt", "ASC"])
        expect(named?.callsOf("andWhere").map((call) => call[0])).toContain("route.accountId = :accountId")
    })

    it("lists the routes of the contact ids oldest first, bounded, under the live-contact join; no ids, no query", async () => {
        const { store, em } = await build()
        const [fake] = queueQueryBuilders(em, [{ getMany: [ROW] }])

        await expect(store.ofContacts(WS, ["c1"], 5)).resolves.toHaveLength(1)
        await expect(store.ofContacts(WS, [], 5)).resolves.toEqual([])
        await expect(store.ofEntrance(WS, [], "zalo", null)).resolves.toBeNull()

        expect(fake?.callsOf("innerJoin")[0]).toEqual([ContactEntity, "contact", LIVE_JOIN])
        expect(fake?.callsOf("limit")[0]).toEqual([5])
        expect(em.createQueryBuilder).toHaveBeenCalledTimes(1)
    })
})

describe("TypeormCustomerRouteStore staff hold (ruling R43: who holds the thread is the route's)", () => {
    const LIVE = Object.assign(new CustomerRouteEntity(), {
        id: "r1",
        workspaceId: WS,
        contactId: "c1",
        channel: "zalo",
        accountId: null,
        heldByMemberId: null,
        heldAt: null,
        createdAt: new Date("2026-11-13T10:00:00.000Z"),
    })
    const HELD = Object.assign(new CustomerRouteEntity(), { ...LIVE, heldByMemberId: "m1", heldAt: new Date("2026-11-14T08:00:00.000Z") })

    it("reads the hold of a live route under the live-contact join; a route nobody holds, or none, answers null", async () => {
        const { store, em } = await build()
        const [held] = queueQueryBuilders(em, [{ getOne: HELD }, { getOne: LIVE }, { getOne: null }])

        await expect(store.holdOf(WS, "r1")).resolves.toEqual({ memberId: "m1", at: "2026-11-14T08:00:00.000Z" })
        await expect(store.holdOf(WS, "r1")).resolves.toBeNull()
        await expect(store.holdOf(WS, "r-gone")).resolves.toBeNull()

        expect(held?.callsOf("innerJoin")[0]?.[0]).toBe(ContactEntity)
        expect(held?.callsOf("andWhere")[0]).toEqual(["route.id = :routeId", { routeId: "r1" }])
    })

    it("lists the held live routes of the workspace, the latest hold first, bounded, with the count of all (R45)", async () => {
        const { store, em } = await build()
        const [list] = queueQueryBuilders(em, [{ getManyAndCount: [[HELD], 3] }])

        await expect(store.held(WS, 2)).resolves.toEqual({
            count: 3,
            routes: [{ routeId: "r1", memberId: "m1", at: "2026-11-14T08:00:00.000Z" }],
        })

        expect(list?.callsOf("innerJoin")[0]?.[0]).toBe(ContactEntity)
        expect(list?.callsOf("andWhere")[0]).toEqual(["route.heldByMemberId IS NOT NULL"])
        expect(list?.callsOf("orderBy")[0]).toEqual(["route.heldAt", "DESC"])
        expect(list?.callsOf("take")[0]).toEqual([2])
    })

    it("sets the member and the database's now on a live route only, keeping the first stamp of the same member", async () => {
        const { store, em } = await build()
        const [, update] = queueQueryBuilders(em, [{ getOne: LIVE }, { execute: { raw: [], affected: 1 } }])

        await expect(store.hold(WS, "r1", "m1")).resolves.toBe(true)

        const [values] = update?.callsOf("set")[0] ?? []
        expect(values).toMatchObject({ heldByMemberId: "m1" })
        expect(typeof (values as { heldAt: unknown }).heldAt).toBe("function")
        expect(update?.callsOf("where")[0]).toEqual(["workspace_id = :workspaceId AND id = :routeId", { workspaceId: WS, routeId: "r1" }])
        expect(update?.callsOf("andWhere")[0]).toEqual(["held_by_member_id IS DISTINCT FROM :memberId", { memberId: "m1" }])
    })

    it("takes no hold on a route the workspace does not hold live (a deleted contact's route): false, no update", async () => {
        const { store, em } = await build()
        queueQueryBuilders(em, [{ getOne: null }])

        await expect(store.hold(WS, "r-gone", "m1")).resolves.toBe(false)
        expect(em.createQueryBuilder).toHaveBeenCalledTimes(1)
    })

    // Postgres's `UPDATE ... RETURNING` answers the row AFTER the update: the release that cleared the hold with `RETURNING held_by_member_id`
    // got its nulls back and answered "nobody held it" for every hand-back (this spec's fake once answered the OLD values, which Postgres
    // never does). The hold is now read first, then cleared for that member only.
    it("reads the hold, then clears that member's hold in one update and answers the hold it cleared", async () => {
        const { store, em } = await build()
        const [read, cleared] = queueQueryBuilders(em, [{ getOne: HELD }, { execute: { raw: [], affected: 1 } }])

        await expect(store.release(WS, "r1")).resolves.toEqual({ memberId: "m1", at: "2026-11-14T08:00:00.000Z" })

        expect(read?.callsOf("andWhere")[0]).toEqual(["route.heldByMemberId IS NOT NULL"])
        expect(cleared?.callsOf("set")[0]).toEqual([{ heldByMemberId: null, heldAt: null }])
        expect(cleared?.callsOf("andWhere")[0]).toEqual(["held_by_member_id = :memberId", { memberId: "m1" }])
        expect(cleared?.callsOf("returning")).toEqual([])
    })

    it("answers null when nobody holds the route (no update), and when the hold changed hands before the update (nothing cleared)", async () => {
        const { store, em } = await build()
        queueQueryBuilders(em, [{ getOne: null }, { getOne: HELD }, { execute: { raw: [], affected: 0 } }])

        await expect(store.release(WS, "r1")).resolves.toBeNull()
        await expect(store.release(WS, "r1")).resolves.toBeNull()
        expect(em.createQueryBuilder).toHaveBeenCalledTimes(3)
    })

    it("reads and clears on the caller's transaction when it hands one (the hand-back's one transaction, R51 item 3)", async () => {
        const { store, em } = await build()
        const tx = mockEntityManager()
        queueQueryBuilders(tx, [{ getOne: HELD }, { execute: { raw: [], affected: 1 } }, { getOne: LIVE }])

        await expect(store.release(WS, "r1", tx)).resolves.toEqual({ memberId: "m1", at: "2026-11-14T08:00:00.000Z" })
        await expect(store.holdOf(WS, "r1", tx)).resolves.toBeNull()

        expect(tx.createQueryBuilder).toHaveBeenCalledTimes(3)
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})
