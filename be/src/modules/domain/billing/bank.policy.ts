import { numberOf } from "./webhook-body.policy"
import type { JsonObject } from "./webhook-body.policy"

/** The simulated Vietcombank connection: there is no real bank integration behind it. */
export const SIMULATED_BANK = {
    key: "vietcombank",
    name: "Vietcombank",
} as const

/** The stored inbound event id of a credit of the simulated bank: `vietcombank:<bank event id>`. */
export const simulatedBankEventId = (eventId: string): string => `${SIMULATED_BANK.key}:${eventId}`

/** The credit the simulated bank door accepts, as its body carries it. */
export interface SimulatedCredit {
    /** The credited amount in VND, always positive. */
    readonly amount: number
    /** The transfer content. */
    readonly content: string
    /** The payer name, or null. */
    readonly sender: string | null
    /** The bank transaction id: the idempotency key. */
    readonly eventId: string
}

/**
 * Reads the body of the simulated bank door: { amount_vnd, content, sender_name?, event_id }. A credit needs an amount above 0 and
 * an event id (text or number); anything else answers null.
 */
export const simulatedCreditOf = (body: JsonObject): SimulatedCredit | null => {
    const amount = numberOf(body.amount_vnd)
    const id = body.event_id
    const eventId = typeof id === "string" || typeof id === "number" ? String(id).trim() : ""
    if (amount === undefined || amount <= 0 || eventId === "") return null
    const sender = typeof body.sender_name === "string" ? body.sender_name.trim() : ""
    return {
        amount,
        content: typeof body.content === "string" ? body.content.trim() : "",
        sender: sender === "" ? null : sender,
        eventId,
    }
}
