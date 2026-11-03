import { builder } from "@starci/jest-preset"
import type { BookingEffectsService, EffectsRow } from "@modules/domain/bookings"
import type { FakeQueryBuilder, QueryBuilderAnswers } from "./entity-query-builder-fake.builder"
import { rowOf } from "./booking-effects.builder"

type BookingEffects = Awaited<ReturnType<BookingEffectsService["apply"]>>
type BookingEvent = Parameters<BookingEffectsService["apply"]>[0]

const BOOKING_ID = "b1"

/** What a booking event that found nothing to do answers. */
export const NO_EFFECTS: BookingEffects = {
    found: false,
    reminders: "none",
    feeVnd: 0,
    handedOff: false,
    notified: false,
}
export const effectsOf: (overrides?: Partial<BookingEffects>) => BookingEffects = builder<BookingEffects>({
    ...NO_EFFECTS,
    found: true,
})
export const eventOf: (overrides?: Partial<BookingEvent>) => BookingEvent = builder<BookingEvent>({
    workspaceId: "ws-1",
    bookingId: BOOKING_ID,
    kind: "status",
})

/** The delivery key the bus hands the `booking_effects` reactor. */
export const CLAIM = {
    consumer: "booking_status_changed__booking_effects",
    dedupeKey: "booking-1:status:confirmed:100",
}
type NextClaimShape = {
    dedupeKey: string
    consumer: string
}

/** The delivery of the next event of the same booking. */
export const NEXT_CLAIM: NextClaimShape = { ...CLAIM, dedupeKey: "booking-1:status:confirmed:101" }

/** The names the owner reads answer for the service and the resource of the booking `found` last read. */
export const SERVICE_NAMES: Map<string, string> = new Map<string, string>()
export const RESOURCE_NAMES: Map<string, string> = new Map<string, string>()

/** Forgets the names the last `found` answered. */
export const namesCleared = (): void => {
    SERVICE_NAMES.clear()
    RESOURCE_NAMES.clear()
}

/** The locked read of the booking as the table holds it; the names of its service and resource are answered by the owner reads. */
export const found = (row: EffectsRow = rowOf()): QueryBuilderAnswers => {
    SERVICE_NAMES.set("service-1", row.service_name)
    RESOURCE_NAMES.set("resource-1", row.resource_name)
    return { getRawOne: { ...row, service_id: "service-1", resource_id: "resource-1" } }
}
/** A found booking whose service no longer has a name to show. */
export const serviceGone = (): QueryBuilderAnswers => {
    const answers = found()
    SERVICE_NAMES.clear()
    return answers
}
export const MISSING: QueryBuilderAnswers = { getRawOne: undefined }
export const CLAIMED: QueryBuilderAnswers = { execute: { raw: [{ id: BOOKING_ID }] } }
export const ALREADY_CLAIMED: QueryBuilderAnswers = { execute: { raw: [] } }
export const RELEASED: QueryBuilderAnswers = { execute: { raw: [] } }
/** The answers of a fee write that changed a row, or matched none when `changed` is false. */
export const feeWritten = (changed: boolean): QueryBuilderAnswers => ({
    execute: { raw: changed ? [{ id: BOOKING_ID }] : [] },
})
export const SELECTED = "select"
/** The trace entry of the claim statement marked `mark`. */
export const claimOf = (mark: string) => `claim:${mark}`
/** The trace entry of the release statement marked `mark`. */
export const releaseOf = (mark: string) => `release:${mark}`

/** What each statement was, in the order the service ran them. */
export const traceOf = (fakes: ReadonlyArray<FakeQueryBuilder>): Array<string> =>
    fakes
        .filter((fake) => fake.calls.length > 0)
        .map((fake) => {
            if (fake.callsOf("getRawOne").length > 0) return SELECTED
            const [set] = fake.callsOf("set")[0] ?? []
            if (typeof set === "object" && set !== null && "cancelFeeVnd" in set)
                return `fee:${String(set.cancelFeeVnd)}`
            const mark = String(fake.callsOf("setParameter")[0]?.[1])
            return fake.callsOf("andWhere").length > 0 ? claimOf(mark) : releaseOf(mark)
        })

type FeeCasesShape = {
    status: string
    fee: number
    recorded: number
    previous: number
    changed: boolean
}

/** The closed statuses with the policy fee, the fee recorded and whether the write changed a row. */
export const FEE_CASES: Array<FeeCasesShape> = [
    { status: "cancelled", fee: 74000, recorded: 74000, previous: 0, changed: true },
    { status: "no_show", fee: 35000, recorded: 35000, previous: 0, changed: true },
    { status: "no_show", fee: 35000, recorded: 1700, previous: 1700, changed: false },
    { status: "cancelled", fee: 0, recorded: 1700, previous: 1700, changed: false },
    { status: "no_show", fee: 0, recorded: 1700, previous: 1700, changed: false },
    { status: "done", fee: 0, recorded: 1700, previous: 1700, changed: false },
]

type HandoffCasesShape3 = {
    phone: null
    email: null
    contact: null
    handedOff: boolean
}

type HandoffCasesShape2 = {
    phone: null
    email: string
    contact: string
    handedOff: boolean
}

type HandoffCasesShape = {
    phone: string
    email: string
    contact: string
    handedOff: boolean
}

/** The contacts of a finished booking handed to inbound events. */
export const HANDOFF_CASES: Array<HandoffCasesShape | HandoffCasesShape2 | HandoffCasesShape3> = [
    { phone: "84912345678", email: "mai@example.com", contact: "84912345678", handedOff: true },
    { phone: null, email: "mai@example.com", contact: "mai@example.com", handedOff: false },
    { phone: null, email: null, contact: null, handedOff: true },
]

type SkippedHandoffCasesShape2 = {
    handoffOrder: boolean
    price: null
}

type SkippedHandoffCasesShape = {
    handoffOrder: boolean
    price: number
}

/** The settings and prices that hand nothing off. */
export const SKIPPED_HANDOFF_CASES: Array<SkippedHandoffCasesShape | SkippedHandoffCasesShape2> = [
    { handoffOrder: false, price: 200000 },
    { handoffOrder: true, price: null },
    { handoffOrder: true, price: 0 },
    { handoffOrder: true, price: -1 },
]

type PublicContactCasesShape2 = {
    lead_id: null
    customer_email: null
}

type PublicContactCasesShape = {
    lead_id: string
    customer_email: string
}

/** The lead and email of a public-page booking. */
export const PUBLIC_CONTACT_CASES: Array<PublicContactCasesShape | PublicContactCasesShape2> = [
    { lead_id: "lead-1", customer_email: "mai@example.com" },
    { lead_id: null, customer_email: null },
]

type HandOffOfResultShape = {
    workspaceId: string
    sender: string
    contact: string | null
    body: string
    amountVnd: number
    ref: string
    leadId: string
}

/** The order the finished booking of Mai is handed to inbound events as, reached through `contact`. */
export const handOffOf = (contact: string | null): HandOffOfResultShape => ({
    workspaceId: "ws-1",
    sender: "Mai",
    contact,
    body: 'vi:bookings.handoff.body:{"service":"Cut"}',
    amountVnd: 200000,
    ref: BOOKING_ID,
    leadId: "lead-1",
})
