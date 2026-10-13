import { dbFailure } from "./outcome"
import type { DbFailure } from "./outcome"

/** The structural part of a PostgREST error a definer function raised. */
interface RpcError {
    readonly code?: string
    readonly message: string
}

const NAMED = /^[A-Za-z][A-Za-z0-9_]*$/u

/**
 * Maps the error of a definer function into the closed outcome vocabulary. A function raises a stable name as the message
 * (`WORKSPACE_INVITES_NOT_FOUND`, `days_invalid`); that name becomes the failure code, else the SQLSTATE does.
 */
export const rpcFailure = (error: RpcError): DbFailure => {
    const code = NAMED.test(error.message) ? error.message : (error.code ?? "transport")
    if (error.code === "42501") return dbFailure("refused", code)
    if (error.code === "P0002") return dbFailure("not-found", code)
    if (error.code === "22023" || error.code === "P0001" || error.code?.startsWith("23") === true) {
        return dbFailure("invalid", code)
    }
    return dbFailure("unavailable", code)
}
