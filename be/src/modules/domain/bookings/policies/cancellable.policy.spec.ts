import { Test } from "@nestjs/testing"
import { cancellableOf } from "./cancellable.policy"
const SUBJECT = Symbol("cancellable.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { cancellableOf } }],
    }).compile()
    return moduleRef.get<typeof import("./cancellable.policy")>(SUBJECT)
}

describe("cancellableOf", () => {
    it("names the booking, its customer, its service and its start", async () => {
        const subject = await build()

        expect(
            subject.cancellableOf({
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

    it("answers none for no row", async () => {
        const subject = await build()

        expect(subject.cancellableOf(undefined)).toBeNull()
    })
})
