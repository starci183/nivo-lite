import { cancellableOf } from "./cancellable.policy"

describe("cancellableOf", () => {
    it("names the booking, its customer, its service and its start", () => {
        expect(
            cancellableOf({
                id: "b-1",
                lead_id: "lead-1",
                customer_name: "Lan",
                service_name: "Massage",
                start_ms: Date.parse("2026-10-15T02:00:00.000Z"),
            }),
        ).toEqual({
            id: "b-1",
            leadId: "lead-1",
            startIso: "2026-10-15T02:00:00.000Z",
            serviceName: "Massage",
            customerName: "Lan",
        })
    })

    it("answers none for no row", () => {
        expect(cancellableOf(undefined)).toBeNull()
    })
})
