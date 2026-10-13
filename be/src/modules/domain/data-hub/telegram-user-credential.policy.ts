import { isRecord } from "@modules/platform/primitives"
import { readJson } from "./telegram-user-json.policy"
import type { TelegramCredential, TelegramLoginState } from "./telegram-user-wizard.contracts"

/** How long a login waits for its code and password. */
export const LOGIN_TTL_MS = 10 * 60_000

const loginOf = (value: unknown): TelegramLoginState | undefined => {
    if (!isRecord(value)) return undefined
    const { session, phone, phoneCodeHash, stage, startedAt } = value
    if (typeof session !== "string" || typeof phone !== "string" || typeof phoneCodeHash !== "string") return undefined
    return {
        stage: stage === "password" ? "password" : "code",
        phone,
        phoneCodeHash,
        session,
        startedAt: Number(startedAt) || 0,
    }
}

/** The credential JSON a connection stores; an empty or broken one is an empty credential. */
export const parseCredential = (raw: string | null | undefined): TelegramCredential => {
    if (raw === null || raw === undefined || raw === "") return {}
    const read = readJson(raw)
    if (!read.ok || !isRecord(read.value)) return {}
    const login = loginOf(read.value.login)
    return {
        ...(typeof read.value.session === "string" && read.value.session !== "" ? { session: read.value.session } : {}),
        ...(login === undefined ? {} : { login }),
    }
}

/** The credential as it is stored. */
export const serializeCredential = (credential: TelegramCredential): string => JSON.stringify(credential)

/** True when a login has waited longer than its life (times are epoch milliseconds from the Clock). */
export const loginExpired = (login: TelegramLoginState, nowMs: number): boolean =>
    nowMs - login.startedAt > LOGIN_TTL_MS
