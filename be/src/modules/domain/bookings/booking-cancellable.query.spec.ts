import { mock } from "@starci/jest-preset"
import { BookingServicesReadService } from "@modules/domain/booking-services"
import { cancellableNamed } from "./booking-cancellable.query"
import type { CancellableRowFacts } from "./booking-facts.contracts"

const START = Date.UTC(2026, 9, 12, 2)
const ROW: CancellableRowFacts = {
    id: "b-1",
    lead_id: "lead-1",
    customer_name: "Mai",
    service_id: "s-1",
    start_ms: START,
}

const servicesNamed = (names: ReadonlyArray<[string, string]>) =>
    mock<BookingServicesReadService>({ namesOf: jest.fn(() => Promise.resolve(new Map(names))) })

describe("cancellableNamed", () => {
    it("names the booking with the current name of its service", async () => {
        const services = servicesNamed([["s-1", "Cut"]])

        await expect(cancellableNamed(services, "ws-1", ROW)).resolves.toEqual({
            id: "b-1",
            leadId: "lead-1",
            startIso: new Date(START).toISOString(),
            serviceName: "Cut",
            customerName: "Mai",
        })

        expect(services.namesOf).toHaveBeenCalledWith("ws-1", ["s-1"])
    })

    it("answers none for no row, without reading", async () => {
        const services = servicesNamed([])

        await expect(cancellableNamed(services, "ws-1", undefined)).resolves.toBeNull()

        expect(services.namesOf).not.toHaveBeenCalled()
    })

    it("answers none when the service is gone", async () => {
        await expect(cancellableNamed(servicesNamed([]), "ws-1", ROW)).resolves.toBeNull()
    })
})
