import { BaseEvent } from "@modules/platform/event-bus"
import type { EventPayload, ParsedEvent } from "@modules/platform/event-bus"
import { isKey, isMember, isTextOrNull, openEnvelope } from "./money-event.policy"

/** Why a booking event was sent: it was created, its status changed, or its time or resource changed. */
export type BookingStatusChangedKind = "created" | "status" | "moved"

/**
 * The payload of the `booking_status_changed` event. The AFTER trigger `bookings_notify` of `public.bookings` publishes it in the
 * transaction that writes the booking, so it is sent when that transaction commits and never when it rolls back. The reactor reads the
 * booking as it is now; `status` and `previous` are only the hint of the change. `dedupeKey` is `<booking>:<kind>:<status>:<txid>`: one
 * change per transaction, whatever order the deliveries arrive in.
 */
export interface BookingStatusChangedInput {
    /** The workspace of the booking. */
    readonly workspaceId: string
    /** The booking that changed. */
    readonly bookingId: string
    /** What kind of change it was. */
    readonly kind: BookingStatusChangedKind
    /** The status the booking had when the change was written. */
    readonly status: string
    /** The status it had before; null for a new booking. */
    readonly previous: string | null
}

/** The payload of the event as published; the dedupe key is derived from the input. */
export interface BookingStatusChangedPayload extends EventPayload, BookingStatusChangedInput {}

const KINDS: ReadonlyArray<BookingStatusChangedKind> = ["created", "status", "moved"]

/**
 * Version 1 of `booking_status_changed`. The SQL trigger `bookings_notify` sends this envelope with `public.event_bus_send`; the class
 * builds the same envelope for specs and reads it for the reactor.
 */
export class BookingStatusChangedEvent extends BaseEvent {
    static readonly eventName = "booking_status_changed"
    static readonly version = 1

    readonly eventName = BookingStatusChangedEvent.eventName

    private constructor(
        readonly eventId: string,
        readonly payload: BookingStatusChangedPayload,
    ) {
        super()
    }

    /** The change is identified by the key the trigger builds: booking, kind, status and the transaction. */
    static create(
        payload: BookingStatusChangedInput,
        transactionId: string,
    ): BookingStatusChangedEvent {
        const key = `${payload.bookingId}:${payload.kind}:${payload.status}:${transactionId}`
        return new BookingStatusChangedEvent(key, { ...payload, dedupeKey: key })
    }

    /** Reads the event envelope; a malformed delivery never reaches the reactor. */
    static parse(envelope: unknown): ParsedEvent<BookingStatusChangedEvent> {
        const opened = openEnvelope(envelope)
        if (opened === null) return null
        const { body } = opened
        const previous = body.previous ?? null
        if (!isTextOrNull(previous)) return null
        if (
            !isKey(body.dedupeKey) ||
            typeof body.workspaceId !== "string" ||
            typeof body.bookingId !== "string" ||
            !isMember(KINDS, body.kind) ||
            typeof body.status !== "string"
        ) {
            return null
        }
        return new BookingStatusChangedEvent(opened.eventId, {
            dedupeKey: body.dedupeKey,
            workspaceId: body.workspaceId,
            bookingId: body.bookingId,
            kind: body.kind,
            status: body.status,
            previous,
        })
    }
}
