import type { HotelIntent, HotelRequest } from "./gateway-turns.contracts"

type Loose = Readonly<Record<string, unknown>>

const INTENTS: ReadonlyArray<HotelIntent> = ["spa_slots", "spa_hold", "room_search", "room_hold"]
const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/u
const YMD = /^\d{4}-\d{2}-\d{2}$/u
const TEXT_MAX = 120
const PARTY_MAX = 20
const NIGHTS_MAX = 30

const isLoose = (value: unknown): value is Loose => typeof value === "object" && value !== null && !Array.isArray(value)

const textOf = (value: unknown, max = TEXT_MAX): string => (typeof value === "string" ? value.trim().slice(0, max) : "")

const countOf = (value: unknown, max: number): number => {
    const number = Number(value)
    return Number.isFinite(number) && number >= 1 ? Math.min(max, Math.round(number)) : 1
}

const pctOf = (value: unknown): number | null => {
    const number = typeof value === "number" ? value : Number.NaN
    return Number.isFinite(number) && number > 0 && number <= 100 ? number : null
}

/** The `hotel_request` member of a reply: an intent the contract names, every other member read and bounded; else null. */
export const readHotelRequest = (value: unknown): HotelRequest | null => {
    if (!isLoose(value)) return null
    const intent = INTENTS.find((entry) => entry === value.intent)
    if (intent === undefined) return null
    const time = textOf(value.time, 5)
    const date = textOf(value.date, 10)
    const phone = textOf(value.phone, 40)
    return {
        intent,
        service: textOf(value.service),
        date: YMD.test(date) ? date : null,
        time: HHMM.test(time) ? time.padStart(5, "0") : null,
        partySize: countOf(value.party_size, PARTY_MAX),
        nights: countOf(value.nights, NIGHTS_MAX),
        roomType: textOf(value.room_type),
        name: textOf(value.contact_name),
        phone: phone === "" ? null : phone,
        discountPct: pctOf(value.discount_pct),
    }
}

/** The request back in the reply contract's member names, for the opaque detail of a proposal. */
export const hotelDetailOf = (request: HotelRequest | null): Loose | null =>
    request === null
        ? null
        : {
              intent: request.intent,
              service: request.service,
              date: request.date,
              time: request.time,
              party_size: request.partySize,
              nights: request.nights,
              room_type: request.roomType,
              contact_name: request.name,
              phone: request.phone,
              discount_pct: request.discountPct,
          }

/** The room a front-desk line names ("phòng 302", "P.302", "p302"), or null. */
export const roomOfText = (text: string): string | null => {
    const match = /(?:ph[oò]ng|\bp\.?)\s*(\d{2,4}[a-z]?)\b/iu.exec(text)
    return match?.[1] ?? null
}
