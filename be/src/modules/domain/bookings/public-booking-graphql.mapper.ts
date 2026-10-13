import type { PublicBookCode, PublicBookParams, PublicBookResult, PublicBookState } from "./bookings.contracts"
import { BookingsError, BookingsErrorCode } from "./errors/bookings.error"

const REFUSALS: Record<PublicBookCode, BookingsErrorCode | null> = {
    name_required: BookingsErrorCode.NameRequired,
    phone_invalid: BookingsErrorCode.PhoneInvalid,
    start_invalid: BookingsErrorCode.DateTimeInvalid,
    service_unavailable: BookingsErrorCode.ServiceNotFound,
    no_resource: BookingsErrorCode.NoResource,
    confirmed: null,
    received_free: null,
    received_taken: null,
}

/** A public booking form whose optional text has not yet received defaults. */
type PublicBookingDraft = Omit<PublicBookParams, "email" | "note" | "website"> &
    Partial<Pick<PublicBookParams, "email" | "note" | "website">>

/** The recorded booking outcome, after refusals have been promoted to errors. */
interface PublicBookingAnswer {
    /** The recorded outcome state. */
    readonly state: PublicBookState
    /** The visitor-facing outcome code. */
    readonly code: PublicBookCode
    /** The service that was requested. */
    readonly serviceName: string
    /** The requested start as ISO 8601. */
    readonly startIso: string
    /** Other starts when the requested time was taken. */
    readonly alternatives: ReadonlyArray<string>
    /** The recorded booking id, when a booking was made. */
    readonly bookingId: string | null
}

/** Applies the existing booking command's empty defaults to optional public form fields. */
export const toRequestPublicBookingRequest = (input: PublicBookingDraft): PublicBookParams => ({
    slug: input.slug,
    serviceId: input.serviceId,
    start: input.start,
    name: input.name,
    phone: input.phone,
    email: input.email ?? "",
    party: input.party,
    note: input.note ?? "",
    token: input.token,
    website: input.website ?? "",
})

/** Answers a recorded booking and promotes refusals to localized domain errors. */
export const toRequestPublicBookingType = (result: PublicBookResult): PublicBookingAnswer => {
    const code = REFUSALS[result.code]
    if (code !== null) throw new BookingsError({ code })
    return {
        state: result.state,
        code: result.code,
        serviceName: result.serviceName,
        startIso: result.startIso,
        alternatives: result.alternatives,
        bookingId: result.bookingId,
    }
}
