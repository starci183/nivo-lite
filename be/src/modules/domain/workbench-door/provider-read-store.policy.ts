import { createHash } from "node:crypto"
import { isRecord } from "@modules/platform/primitives"
import {
    PROVIDER_READ_FRESH,
    type InterfaceCall,
    type InterfaceProviderAnswer,
    type InterfaceReadSchema,
    type ProviderReadName,
    type ProviderReadPayload,
} from "./provider-reads.contracts"

/**
 * Splits a named read's payload: the input the provider is handed (every member but `fresh`), the account it names and whether the
 * caller asked for a live answer. Only an exact `fresh: true` asks; a `connectionId` that is no non-empty text names no account.
 */
export const providerReadPayloadOf = (payload: InterfaceReadSchema): ProviderReadPayload => {
    const input = Object.fromEntries(Object.entries(payload).filter(([name]) => name !== PROVIDER_READ_FRESH))
    const connectionId = payload.connectionId
    return {
        input,
        connectionId: typeof connectionId === "string" && connectionId !== "" ? connectionId : null,
        fresh: payload[PROVIDER_READ_FRESH] === true,
    }
}

/** True when a live answer is one the account keeps: a page or a record; a refusal proves nothing about the account. */
export const isKeptAnswer = (answer: InterfaceProviderAnswer): boolean => answer.kind === "page" || answer.kind === "record"

/** True when a stored value is a page or a record as a provider answered it (what `isKeptAnswer` let the account keep). */
export const isStoredProviderAnswer = (value: unknown): value is InterfaceProviderAnswer => {
    if (!isRecord(value)) return false
    if (value.kind === "page") {
        return (
            Array.isArray(value.rows) &&
            (typeof value.cursor === "string" || value.cursor === null) &&
            typeof value.truncated === "boolean" &&
            typeof value.omitted === "number"
        )
    }
    return value.kind === "record" && "record" in value && typeof value.truncated === "boolean"
}

/** Orders two names by code unit: negative, zero or positive. */
const byName = (left: string, right: string): number => {
    if (left < right) return -1
    return left > right ? 1 : 0
}

/** A JSON value with the members of every object in code-unit order, so the same arguments always give the same text. */
const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map((item: unknown) => canonical(item))
    if (!isRecord(value)) return value ?? null
    const members = Object.entries(value).filter((entry) => entry[1] !== undefined)
    members.sort((left, right) => byName(left[0], right[0]))
    return Object.fromEntries(members.map(([name, member]) => [name, canonical(member)]))
}

/** The interface call of a verb and its arguments: the same verb and arguments always name the same stored answer. */
export const interfaceCallOf = (verb: string, args: unknown): InterfaceCall => ({
    verb,
    argsHash: createHash("sha256")
        .update(JSON.stringify(canonical(args)))
        .digest("hex"),
})

/**
 * The verb a named read's answer is stored under: `<provider>:<read>`, so an answer of one provider's read is never served for another
 * provider's read of the same name.
 */
export const snapshotVerbOf = (name: ProviderReadName): string => `${name.provider}:${name.read}`

/** The key of the stored answer of a call: `<verb>:<argsHash>` (the declared key fields of `interface.snapshot`, joined). */
export const snapshotKeyOf = (call: InterfaceCall): string => `${call.verb}:${call.argsHash}`
