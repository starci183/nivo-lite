import { mock } from "@starci/jest-preset"
import { BookingResourcesReadService } from "@modules/domain/booking-resources"
import { BookingServicesReadService } from "@modules/domain/booking-services"
import { rowOf } from "@tests/fixtures/builders/booking-effects.builder"
import { effectsNamed } from "./booking-effects.query"

const BASE = { ...rowOf(), service_id: "s-1", resource_id: "r-1" }

const readsOf = (services: ReadonlyArray<[string, string]>, resources: ReadonlyArray<[string, string]>) => ({
    services: mock<BookingServicesReadService>({ namesOf: jest.fn(() => Promise.resolve(new Map(services))) }),
    resources: mock<BookingResourcesReadService>({ namesOf: jest.fn(() => Promise.resolve(new Map(resources))) }),
})

describe("effectsNamed", () => {
    it("names the booking with its service and resource", async () => {
        const { services, resources } = readsOf([["s-1", "Cut"]], [["r-1", "Anna"]])

        const row = await effectsNamed(services, resources, BASE)

        expect(row).toEqual({ ...rowOf(), service_name: "Cut", resource_name: "Anna" })
        expect(row).not.toHaveProperty("service_id")
        expect(services.namesOf).toHaveBeenCalledWith(BASE.workspace_id, ["s-1"])
        expect(resources.namesOf).toHaveBeenCalledWith(BASE.workspace_id, ["r-1"])
    })

    it("leaves the resource name empty when the resource is gone", async () => {
        const { services, resources } = readsOf([["s-1", "Cut"]], [])

        await expect(effectsNamed(services, resources, BASE)).resolves.toMatchObject({ resource_name: "" })
    })

    it("answers none when the service is gone", async () => {
        const { services, resources } = readsOf([], [["r-1", "Anna"]])

        await expect(effectsNamed(services, resources, BASE)).resolves.toBeNull()
    })
})
