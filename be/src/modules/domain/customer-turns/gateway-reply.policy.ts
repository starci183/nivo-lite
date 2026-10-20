type Loose = Readonly<Record<string, unknown>>

const SLOT_SHOWN = 4
const ROOM_SHOWN = 4

const isLoose = (value: unknown): value is Loose => typeof value === "object" && value !== null && !Array.isArray(value)

const listOf = (value: unknown): ReadonlyArray<Loose> => (Array.isArray(value) ? value.filter(isLoose) : [])

/** A text member, or empty. */
export const textAt = (value: Loose | null, key: string): string => {
    const member = value?.[key]
    if (typeof member === "string") return member
    return typeof member === "number" ? String(member) : ""
}

/** A number member, or null. */
export const numberAt = (value: Loose, key: string): number | null => {
    const member = value[key]
    return typeof member === "number" && Number.isFinite(member) ? member : null
}

/** HH:MM of an ISO instant in Vietnam time, or the text itself when it has no time. */
export const clockOf = (iso: string): string => {
    const at = Date.parse(iso)
    if (!Number.isFinite(at)) return iso
    const vn = new Date(at + 7 * 3_600_000)
    return `${String(vn.getUTCHours()).padStart(2, "0")}:${String(vn.getUTCMinutes()).padStart(2, "0")}`
}

/** One spa slot of `spa.findSlots`. */
export interface SlotRef {
    /** The slot id. */
    readonly slotId: string
    /** Its start time, HH:MM in Vietnam time. */
    readonly time: string
}

/** The slots of a `spa.findSlots` result. */
export const slotsOf = (result: Loose): ReadonlyArray<SlotRef> =>
    listOf(result.slots).flatMap((slot) => {
        const slotId = textAt(slot, "slotId")
        return slotId === "" ? [] : [{ slotId, time: clockOf(textAt(slot, "startsAt")) }]
    })

/** The slot at the wished time, else the first one at or after it, else null. */
export const slotAt = (slots: ReadonlyArray<SlotRef>, time: string | null): SlotRef | null => {
    if (time === null) return slots[0] ?? null
    return slots.find((slot) => slot.time === time) ?? slots.find((slot) => slot.time >= time) ?? null
}

/** The slot times for a reply. */
export const slotTimesOf = (slots: ReadonlyArray<SlotRef>): string =>
    slots
        .slice(0, SLOT_SHOWN)
        .map((slot) => slot.time)
        .join(", ")

/** The free room types of a `rooms.searchAvailability` result: name (count). */
export const roomsOf = (result: Loose): ReadonlyArray<{ readonly roomType: string; readonly label: string }> =>
    listOf(result.roomTypes).flatMap((option) => {
        const roomType = textAt(option, "code")
        const available = numberAt(option, "available") ?? 0
        if (roomType === "" || available <= 0) return []
        return [{ roomType, label: `${textAt(option, "name") || roomType} (${String(available)})` }]
    })

/** The room labels for a reply. */
export const roomLabelsOf = (rooms: ReadonlyArray<{ readonly label: string }>): string =>
    rooms
        .slice(0, ROOM_SHOWN)
        .map((room) => room.label)
        .join(", ")

/** The guest id of a `guest.upsertByChannelIdentity` / `guest.findByChannelIdentity` result, or null. */
export const guestIdOf = (result: Loose): string | null => {
    const direct = textAt(result, "guestId")
    if (direct !== "") return direct
    const guest = result.guest
    return isLoose(guest) && typeof guest.guestId === "string" && guest.guestId !== "" ? guest.guestId : null
}

/** The customer id of a channel external id ("123:archived" → "123"). */
export const customerIdOf = (externalId: string): string => {
    const colon = externalId.indexOf(":")
    return colon < 0 ? externalId : externalId.slice(0, colon)
}

/** The first night's rate of a `rates.quote` result, or null. */
export const nightlyOf = (result: Loose): number | null => {
    const first = listOf(result.nights)[0]
    return first === undefined ? null : numberAt(first, "rateVnd")
}
