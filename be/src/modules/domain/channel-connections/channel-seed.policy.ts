import { ConnectionsError, ConnectionsErrorCode } from "@modules/domain/connections"
import type { SeedPayos, SeedSepay } from "./channel-seed.contracts"
import { accountFacts, clean, isAccountNumber, isSepayKey, squeeze } from "./money-provider.policy"

/** What a sealed seed value reads as when its owner has not issued it yet. */
const PENDING_PREFIX = "PENDING-"

/** The payOS keys of a connection, as the wizard stores them. */
export type PayosKeys = Readonly<Record<"clientId" | "apiKey" | "checksumKey", string>>

/** Refuses a seed whose `field` is malformed; the error names the field, never its value. */
export const invalidSeed = (field: string): never => {
    throw new ConnectionsError({ code: ConnectionsErrorCode.CommandInvalid, params: { field } })
}

/** The trimmed value, or undefined when it is absent or empty. */
export const filled = (value: string | undefined): string | undefined => {
    const text = value?.trim() ?? ""
    return text === "" ? undefined : text
}

/** The OA secret key, or undefined when it is absent or a `PENDING-` placeholder: such a value is never stored. */
export const oaSecretOf = (value: string | undefined): string | undefined => {
    const text = filled(value)
    return text?.startsWith(PENDING_PREFIX) === true ? undefined : text
}

/** The public bank facts of a SePay seed: all three given make them, none make none, a part of them is refused. */
export const bankFactsOf = (seed: SeedSepay): Readonly<Record<string, string>> => {
    const bankCode = clean(seed.bankCode ?? "", 20).toUpperCase()
    const holder = clean(seed.holder ?? "", 80).toUpperCase()
    const account = squeeze(seed.accountNumber ?? "")
    if (bankCode === "" && holder === "" && account === "") return {}
    if (bankCode === "" || holder === "" || !isAccountNumber(account)) return invalidSeed("sepay.bank")
    return { bank_code: bankCode, account_holder: holder, ...accountFacts(account) }
}

/** The SePay webhook key of a seed, or undefined when none is given; a malformed one is refused. */
export const sepayKeyOf = (seed: SeedSepay): string | undefined => {
    const key = filled(seed.apiKey)
    return key === undefined || isSepayKey(key) ? key : invalidSeed("sepay.apiKey")
}

/** The payOS keys of a seed, or undefined when none is given; a part of them is refused. */
export const payosKeysOf = (seed: SeedPayos): PayosKeys | undefined => {
    const clientId = filled(seed.clientId)
    const apiKey = filled(seed.apiKey)
    const checksumKey = filled(seed.checksumKey)
    if (clientId === undefined && apiKey === undefined && checksumKey === undefined) return undefined
    if (clientId === undefined || apiKey === undefined || checksumKey === undefined) return invalidSeed("payos")
    return { clientId, apiKey, checksumKey }
}
