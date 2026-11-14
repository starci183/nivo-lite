import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ContactsService } from "@modules/domain/contacts/contacts.service"
import { MemoryCustomerRouteStore } from "@tests/fixtures/builders/customer-routes-stores.builder"
import { CUSTOMER_ROUTE_STORE, type CustomerRouteStore } from "./customer-route-store.port"
import { CustomerRoutesService } from "./customer-routes.service"
import { CustomerRoutesError, CustomerRoutesErrorCode } from "./errors/customer-routes.error"

const WS = "ws-1"
const ZALO = { channel: "zalo", accountId: "conn-1" }
const KNOWN = ["contact-1", "contact-old", "contact-2"]
/** `contact-gone` was DELETED (soft delete, R31): the workspace still holds it, no live contact answers for it. */
const DELETED = "contact-gone"

/** The contacts: `contact-old` was merged into `contact-1`; `ghost` is nobody; `contact-gone` is deleted. */
const build = async () => {
    const store = new MemoryCustomerRouteStore()
    const contacts = mock<ContactsService>()
    contacts.current.mockImplementation((_ws, id) =>
        Promise.resolve(id === "contact-old" ? "contact-1" : [...KNOWN, DELETED].includes(id) ? id : null),
    )
    contacts.activeId.mockImplementation((_ws, id) => Promise.resolve(id === "contact-old" ? "contact-1" : KNOWN.includes(id) ? id : null))
    contacts.aliasesOf.mockImplementation((_ws, id) => Promise.resolve(id === "contact-1" ? ["contact-1", "contact-old"] : [id]))
    const moduleRef = await Test.createTestingModule({
        providers: [
            CustomerRoutesService,
            { provide: CUSTOMER_ROUTE_STORE, useValue: store },
            { provide: ContactsService, useValue: contacts },
        ],
    }).compile()
    return { service: moduleRef.get(CustomerRoutesService), store }
}

const codeOf = async (work: Promise<unknown>): Promise<unknown> => {
    try {
        await work
        return null
    } catch (cause) {
        return cause instanceof CustomerRoutesError ? cause.code : cause
    }
}

describe("CustomerRoutesService.ensure", () => {
    it("writes the route once and answers the same id on every later call", async () => {
        const { service, store } = await build()

        const first = await service.ensure(WS, { contactId: "contact-1", ...ZALO })
        const second = await service.ensure(WS, { contactId: "contact-1", ...ZALO })

        expect(first.created).toBe(true)
        expect(second).toEqual({ routeId: first.routeId, created: false })
        expect(store.rows).toHaveLength(1)
        expect(store.inserts).toBe(1)
    })

    it("keeps one route per entrance: another channel, account or person is another route, and no account is one value", async () => {
        const { service, store } = await build()

        const ids = [
            await service.ensure(WS, { contactId: "contact-1", ...ZALO }),
            await service.ensure(WS, { contactId: "contact-1", channel: "zalo", accountId: "conn-2" }),
            await service.ensure(WS, { contactId: "contact-1", channel: "telegram", accountId: "conn-1" }),
            await service.ensure(WS, { contactId: "contact-2", ...ZALO }),
            await service.ensure(WS, { contactId: "contact-1", channel: "website", accountId: null }),
        ]
        const again = await service.ensure(WS, { contactId: "contact-1", channel: "website", accountId: null })

        expect(new Set(ids.map((one) => one.routeId)).size).toBe(5)
        expect(again.created).toBe(false)
        expect(store.rows).toHaveLength(5)
    })

    it("adopts the id of an existing conversation when the route is born, so holds keyed by that id keep working (R10)", async () => {
        const { service, store } = await build()

        const adopted = await service.ensure(WS, { contactId: "contact-1", ...ZALO, adoptId: "chat-77" })

        expect(adopted).toEqual({ routeId: "chat-77", created: true })
        expect(store.rows[0]?.id).toBe("chat-77")
        await expect(service.get(WS, "chat-77")).resolves.toMatchObject({ contactId: "contact-1", channel: "zalo", accountId: "conn-1" })
    })

    it("keeps the id a route already has when another id is offered later", async () => {
        const { service } = await build()
        const born = await service.ensure(WS, { contactId: "contact-1", ...ZALO })

        const later = await service.ensure(WS, { contactId: "contact-1", ...ZALO, adoptId: "chat-77" })

        expect(later).toEqual({ routeId: born.routeId, created: false })
        await expect(service.get(WS, "chat-77")).resolves.toBeNull()
    })

    it("leaves ONE row when two tries race: the loser reads the winner", async () => {
        const { service, store } = await build()

        const [left, right] = await Promise.all([
            service.ensure(WS, { contactId: "contact-1", ...ZALO, adoptId: "chat-a" }),
            service.ensure(WS, { contactId: "contact-1", ...ZALO, adoptId: "chat-b" }),
        ])

        expect(store.rows).toHaveLength(1)
        expect(left.routeId).toBe(right.routeId)
        expect([left.created, right.created].toSorted()).toEqual([false, true])
    })

    it("answers the winner when another try wrote the key between the first read and the insert", async () => {
        const { service, store } = await build()
        const real = store.ofEntrance.bind(store)
        let reads = 0
        store.ofEntrance = async (...args) => {
            reads += 1
            if (reads === 1) {
                await store.insert(WS, { id: "chat-won", contactId: "contact-1", channel: "zalo", accountId: "conn-1" })
                return null
            }
            return real(...args)
        }

        await expect(service.ensure(WS, { contactId: "contact-1", ...ZALO })).resolves.toEqual({ routeId: "chat-won", created: false })
        expect(store.rows).toHaveLength(1)
    })

    it("refuses an id that already names another route", async () => {
        const { service } = await build()
        await service.ensure(WS, { contactId: "contact-2", ...ZALO, adoptId: "chat-77" })

        await expect(codeOf(service.ensure(WS, { contactId: "contact-1", ...ZALO, adoptId: "chat-77" }))).resolves.toBe(
            CustomerRoutesErrorCode.IdTaken,
        )
    })

    it("refuses a person the workspace does not hold", async () => {
        const { service, store } = await build()

        await expect(codeOf(service.ensure(WS, { contactId: "ghost", ...ZALO }))).resolves.toBe(CustomerRoutesErrorCode.ContactUnknown)
        expect(store.rows).toHaveLength(0)
    })
})

describe("CustomerRoutesService with a deleted contact (soft delete, R31)", () => {
    it("keeps the routes in the store and answers nothing for them: no new route, no find, no list for the deleted person", async () => {
        const { service, store } = await build()
        store.rows.push({ workspaceId: WS, id: "route-gone", contactId: DELETED, channel: "zalo", accountId: "conn-1", createdAt: "2026-11-13T10:00:00.000Z" })

        await expect(codeOf(service.ensure(WS, { contactId: DELETED, ...ZALO }))).resolves.toBe(CustomerRoutesErrorCode.ContactUnknown)
        await expect(service.find(WS, DELETED, ZALO)).resolves.toBeNull()
        await expect(service.listByContact(WS, DELETED)).resolves.toEqual([])
        expect(store.rows.map((row) => row.id)).toEqual(["route-gone"])
    })

    it("meets the same person writing again as a NEW contact with its own route, beside the deleted contact's route", async () => {
        const { service, store } = await build()
        store.rows.push({ workspaceId: WS, id: "route-gone", contactId: DELETED, channel: "zalo", accountId: "conn-1", createdAt: "2026-11-13T10:00:00.000Z" })

        const fresh = await service.ensure(WS, { contactId: "contact-2", ...ZALO })

        expect(fresh.created).toBe(true)
        expect(fresh.routeId).not.toBe("route-gone")
        expect(store.rows.map((row) => row.id)).toContain("route-gone")
    })
})

describe("CustomerRoutesService merges", () => {
    const OLD_ROUTE = {
        workspaceId: WS,
        id: "route-old",
        contactId: "contact-old",
        channel: "zalo",
        accountId: "conn-1",
        createdAt: "2026-11-13T10:00:00.000Z",
    }

    it("finds the route written under a merged id when asked for the survivor, and the other way round", async () => {
        const { service, store } = await build()
        store.rows.push(OLD_ROUTE)

        await expect(service.ensure(WS, { contactId: "contact-1", ...ZALO })).resolves.toEqual({ routeId: "route-old", created: false })
        await expect(service.ensure(WS, { contactId: "contact-old", ...ZALO })).resolves.toEqual({ routeId: "route-old", created: false })
        expect(store.rows).toHaveLength(1)
    })

    it("writes a new route under the survivor id when asked with a merged id", async () => {
        const { service, store } = await build()

        await service.ensure(WS, { contactId: "contact-old", ...ZALO })

        expect(store.rows[0]?.contactId).toBe("contact-1")
    })

    it("answers a route's contact as the survivor, and lists the routes of both ids under it", async () => {
        const { service, store } = await build()
        store.rows.push(OLD_ROUTE)
        await service.ensure(WS, { contactId: "contact-1", channel: "telegram", accountId: "conn-9" })

        await expect(service.get(WS, "route-old")).resolves.toMatchObject({ contactId: "contact-1" })
        const listed = await service.listByContact(WS, "contact-old")
        expect(listed.map((route) => route.channel)).toEqual(["zalo", "telegram"])
        expect(listed.every((route) => route.contactId === "contact-1")).toBe(true)
        await expect(service.find(WS, "contact-old", ZALO)).resolves.toMatchObject({ id: "route-old", contactId: "contact-1" })
    })
})

describe("CustomerRoutesService held routes (R45: the inbox's held-by-a-person filter and count)", () => {
    it("asks the store for one page of the held routes, bounded to 1..100, and answers the page and the count as the store gives them", async () => {
        const store = mock<CustomerRouteStore>()
        const page = { count: 2, routes: [{ routeId: "r-2", memberId: "m-1", at: "2026-11-14T08:00:00.000Z" }] }
        store.held.mockResolvedValue(page)
        const moduleRef = await Test.createTestingModule({
            providers: [
                CustomerRoutesService,
                { provide: CUSTOMER_ROUTE_STORE, useValue: store },
                { provide: ContactsService, useValue: mock<ContactsService>() },
            ],
        }).compile()
        const service = moduleRef.get(CustomerRoutesService)

        await expect(service.held(WS, 1)).resolves.toEqual(page)
        await service.held(WS)
        await service.held(WS, 0)
        await service.held(WS, 5000)

        expect(store.held.mock.calls).toEqual([[WS, 1], [WS, 100], [WS, 1], [WS, 100]])
    })
})

describe("CustomerRoutesService reads", () => {
    it("answers nothing for an unknown id, a route of another workspace and a person nobody holds", async () => {
        const { service } = await build()
        const born = await service.ensure(WS, { contactId: "contact-1", ...ZALO })

        await expect(service.get(WS, "nope")).resolves.toBeNull()
        await expect(service.get("ws-2", born.routeId)).resolves.toBeNull()
        await expect(service.listByContact(WS, "ghost")).resolves.toEqual([])
        await expect(service.find(WS, "ghost", ZALO)).resolves.toBeNull()
    })

    it("bounds a list by its limit", async () => {
        const { service } = await build()
        await service.ensure(WS, { contactId: "contact-1", channel: "zalo", accountId: "a" })
        await service.ensure(WS, { contactId: "contact-1", channel: "zalo", accountId: "b" })

        await expect(service.listByContact(WS, "contact-1", 1)).resolves.toHaveLength(1)
        await expect(service.listByContact(WS, "contact-1", 0)).resolves.toHaveLength(1)
    })
})
