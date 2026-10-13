import { dbFailure } from "../outcome"
import type { DbFailure } from "../outcome"

/** What `read_app_command` answers. */
export interface CommandState {
    readonly state: string
    readonly result: Readonly<Record<string, unknown>> | null
    readonly errorCode: string | null
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** Reads the answer of `read_app_command`; null when it is not the shape the function promises. */
export const commandStateOf = (value: unknown): CommandState | null => {
    if (!isRecord(value) || typeof value.state !== "string") return null
    return {
        state: value.state,
        result: isRecord(value.result) ? value.result : null,
        errorCode: typeof value.errorCode === "string" ? value.errorCode : null,
    }
}

const INVALID = ["EMAIL_INVALID", "ALREADY_MEMBER", "STAFF_TAKEN", "PROJECT_BUSY", "SPEC_INVALID", "RENDER_REJECTED"]

/** The failure a settled command carries: the code the back end gave, sorted into the outcome vocabulary. */
export const commandFailure = (code: string | null): DbFailure => {
    const named = code ?? "unavailable"
    if (named.includes("NOT_FOUND")) return dbFailure("not-found", named)
    if (named.includes("FORBIDDEN") || named.includes("NOT_MEMBER")) return dbFailure("refused", named)
    if (INVALID.some((part) => named.endsWith(part))) return dbFailure("invalid", named)
    return dbFailure("unavailable", named)
}
