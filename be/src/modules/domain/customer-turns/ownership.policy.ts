import type { GuestContext, OwnerChoice, StayStage } from "./gateway-turns.contracts"

type Loose = Readonly<Record<string, unknown>>

/** Vietnam time: the arrival day starts at 00:00 +07. */
const VN_OFFSET_MS = 7 * 3_600_000
const DAY_MS = 86_400_000

const isLoose = (value: unknown): value is Loose => typeof value === "object" && value !== null && !Array.isArray(value)

const textOf = (value: unknown): string => (typeof value === "string" ? value : "")

/** The stage a `stay.current` result says. */
export const stageOfStay = (stay: unknown): StayStage => {
    if (!isLoose(stay)) return { kind: "none" }
    const status = textOf(stay.status)
    if (status === "checked_in") return { kind: "checked_in" }
    if (status === "checked_out") return { kind: "checked_out", at: textOf(stay.checkedOutAt) || textOf(stay.checkOut) }
    const checkIn = textOf(stay.checkIn)
    if (checkIn === "") return { kind: "none" }
    // hakuen-mcp@1: a stay exists only once its booking is confirmed ("reserved"); held bookings have no stay yet.
    return { kind: "booked", confirmed: status === "reserved", checkIn }
}

/** The guest context of `guest.findByChannelIdentity` and `stay.current` results. */
export const guestContextOf = (guestResult: Loose | null, stayResult: Loose | null): GuestContext => {
    const guest = isLoose(guestResult?.guest) ? guestResult.guest : null
    const stay = isLoose(stayResult?.stay) ? stayResult.stay : null
    return {
        guestId: textOf(guest?.guestId) || null,
        name: textOf(guest?.name) || textOf(stay?.guestName),
        tier: textOf(guest?.tier),
        stayId: textOf(stay?.stayId) || null,
        room: textOf(stay?.roomNumber),
        stage: stageOfStay(stay),
    }
}

/** 00:00 +07 of the day of an ISO date or instant, epoch ms; NaN when unreadable. */
const arrivalDayStart = (checkIn: string): number => {
    const date = /^\d{4}-\d{2}-\d{2}/u.exec(checkIn)?.[0]
    return date === undefined ? Number.NaN : Date.parse(`${date}T00:00:00Z`) - VN_OFFSET_MS
}

/**
 * Who owns a guest's conversation on the one Zalo OA. No booking, or one only held or pending: Sales. A confirmed booking from 00:00
 * of the arrival day, or a checked-in stay: Customer care. Checked out: Customer care for 24 hours, then Sales again.
 */
export const ownerFor = (stage: StayStage, now: Date): OwnerChoice => {
    const at = now.getTime()
    if (stage.kind === "checked_in") return { role: "care", reason: "checked_in" }
    if (stage.kind === "checked_out") {
        const out = Date.parse(stage.at)
        return Number.isFinite(out) && at - out < DAY_MS
            ? { role: "care", reason: "checked_in" }
            : { role: "sales", reason: "checked_out_24h" }
    }
    if (stage.kind === "booked" && stage.confirmed && at >= arrivalDayStart(stage.checkIn)) {
        return { role: "care", reason: "arrival_day" }
    }
    return { role: "sales", reason: "pre_arrival" }
}
