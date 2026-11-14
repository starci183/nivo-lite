import { mock } from "@starci/jest-preset"
import type { EntityManager } from "typeorm"
import type { CustomerRouteStore, StoredCustomerRoute } from "@modules/domain/customer-routes/customer-route-store.port"
import { ErasedContactRunsAdapter } from "./erased-contact-runs.adapter"
import { ErasedSubjectRunsService } from "./erased-subject-runs.service"

const TX = {} as EntityManager

const route = (id: string, contactId: string): StoredCustomerRoute => ({
    id,
    contactId,
    channel: "zalo",
    accountId: "conn-1",
    createdAt: "2026-11-14T08:00:00.000Z",
})

const build = (routes: ReadonlyArray<StoredCustomerRoute>) => {
    const erased = mock<ErasedSubjectRunsService>({ ended: jest.fn().mockResolvedValue(2) })
    const store = mock<CustomerRouteStore>({ ofContacts: jest.fn().mockResolvedValue(routes) })
    return { adapter: new ErasedContactRunsAdapter(erased, store), erased, store }
}

describe("ErasedContactRunsAdapter (CONTACT_RUNS, ruling R37: the runs of a deleted person end in the deletion's transaction)", () => {
    it("ends the runs keyed on every id of the person and on every route they hold, in the caller's transaction", async () => {
        const { adapter, erased, store } = build([route("route-1", "c-1"), route("route-2", "c-old")])

        await expect(adapter.erasing(TX, "ws-1", ["c-1", "c-old"])).resolves.toBe(2)

        expect(store.ofContacts).toHaveBeenCalledWith("ws-1", ["c-1", "c-old"], 100)
        expect(erased.ended).toHaveBeenCalledWith(TX, "ws-1", [
            { kind: "contactId", id: "c-1" },
            { kind: "contactId", id: "c-old" },
            { kind: "routeId", id: "route-1" },
            { kind: "routeId", id: "route-2" },
        ])
    })

    it("still ends the runs keyed on the person when they hold no route", async () => {
        const { adapter, erased } = build([])

        await adapter.erasing(TX, "ws-1", ["c-1"])

        expect(erased.ended).toHaveBeenCalledWith(TX, "ws-1", [{ kind: "contactId", id: "c-1" }])
    })

    it("reads nothing and ends nothing for no contact", async () => {
        const { adapter, erased, store } = build([])

        await expect(adapter.erasing(TX, "ws-1", [])).resolves.toBe(0)

        expect(store.ofContacts).not.toHaveBeenCalled()
        expect(erased.ended).not.toHaveBeenCalled()
    })
})
