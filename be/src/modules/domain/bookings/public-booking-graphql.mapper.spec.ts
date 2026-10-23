import { Test } from "@nestjs/testing"
import type { PublicBookResult } from "./bookings.contracts"
import { BookingsErrorCode } from "./errors/bookings.error"
import { toRequestPublicBookingRequest, toRequestPublicBookingType } from "./public-booking-graphql.mapper"

const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}
const SUBJECT = Symbol("public-booking-graphql.mapper")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toRequestPublicBookingRequest, toRequestPublicBookingType } }],
    }).compile()
    return moduleRef.get<typeof import("./public-booking-graphql.mapper")>(SUBJECT)
}

const INPUT = {
    slug: "hair-shop",
    serviceId: "service-1",
    start: "2026-10-14T02:00:00.000Z",
    name: "Mai",
    phone: "0901234567",
    party: 2,
    token: "form-token",
}

const RESULT: PublicBookResult = {
    ok: true,
    state: "confirmed",
    code: "confirmed",
    serviceName: "Haircut",
    startIso: INPUT.start,
    alternatives: ["2026-10-14T03:00:00.000Z"],
    bookingId: "booking-1",
}

describe("public booking GraphQL mapper", () => {
    it("fills omitted optional text with empty strings", async () => {
        const subject = await build()

        expect(subject.toRequestPublicBookingRequest(INPUT)).toEqual({ ...INPUT, email: "", note: "", website: "" })
    })

    it("preserves all the supplied public form fields", async () => {
        const subject = await build()

        const input = { ...INPUT, email: "mai@example.test", note: "Window seat", website: "honeypot" }
        expect(subject.toRequestPublicBookingRequest(input)).toEqual(input)
    })

    it.each(["confirmed", "received_free", "received_taken"] as const)(
        "answers the recorded %s outcome",
        async (code) => {
            const subject = await build()

            expect(subject.toRequestPublicBookingType({ ...RESULT, code })).toEqual({
                state: "confirmed",
                code,
                serviceName: "Haircut",
                startIso: INPUT.start,
                alternatives: ["2026-10-14T03:00:00.000Z"],
                bookingId: "booking-1",
            })
        },
    )

    it("keeps the waiting state and absent identity of an unanswered request", async () => {
        const subject = await build()

        expect(
            subject.toRequestPublicBookingType({
                ...RESULT,
                state: "waiting",
                code: "received_taken",
                bookingId: null,
            }),
        ).toEqual({
            state: "waiting",
            code: "received_taken",
            serviceName: "Haircut",
            startIso: INPUT.start,
            alternatives: ["2026-10-14T03:00:00.000Z"],
            bookingId: null,
        })
    })

    it.each([
        ["name_required", BookingsErrorCode.NameRequired],
        ["phone_invalid", BookingsErrorCode.PhoneInvalid],
        ["start_invalid", BookingsErrorCode.DateTimeInvalid],
        ["service_unavailable", BookingsErrorCode.ServiceNotFound],
        ["no_resource", BookingsErrorCode.NoResource],
    ] as const)("promotes %s to the domain error", async (code, expectedCode) => {
        const subject = await build()

        expect(
            thrownBy(() => subject.toRequestPublicBookingType({ ...RESULT, ok: false, state: "invalid", code })),
        ).toEqual(objectLike({ code: expectedCode }))
    })
})
