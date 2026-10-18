import { randomBytes } from "node:crypto"

/** The prefix of every payment order code NIVO prints on a transfer. */
export const ORDER_PREFIX = "NIVO"

const ORDER_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
const ORDER_LENGTH = 5

/** A text that may carry an order code: a transfer content, a description or nothing. */
export type TransferText = string | null | undefined

/** Source of random bytes; the default is the operating system's, a spec passes a fixed one. */
export type RandomBytes = (size: number) => Uint8Array

/** A new order code: "NIVO" and 5 characters from an alphabet without 0/O/1/I/L (easy to read out and to type). */
export const newOrderCode = (random: RandomBytes = randomBytes): string =>
    ORDER_PREFIX + Array.from(random(ORDER_LENGTH), (byte) => ORDER_ALPHABET[byte % ORDER_ALPHABET.length]).join("")

/**
 * Every order code a transfer text might name. Banks drop or add spaces and dashes and change case
 * ("nivo 8f3k2 - chuyen tien"), so each text is compared upper-cased with only letters and digits kept.
 */
export const orderCodesIn = (...texts: ReadonlyArray<TransferText>): Array<string> => {
    const found = new Set<string>()
    const pattern = new RegExp(`${ORDER_PREFIX}([${ORDER_ALPHABET}]{${ORDER_LENGTH}})`, "g")
    for (const text of texts) {
        const compact = (text ?? "")
            .normalize("NFKD")
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, "")
        for (let at = compact.indexOf(ORDER_PREFIX); at >= 0; at = compact.indexOf(ORDER_PREFIX, at + 1)) {
            pattern.lastIndex = at
            const match = pattern.exec(compact)
            if (match?.index === at) found.add(match[0])
        }
    }
    return [...found]
}
