import { deserialize, serialize } from "@/modules/superjson"
import { WORKSPACE_COOKIE } from "./ids"
import type { StorageId } from "./ids"

/** A typed view over one Web Storage area; every access is guarded because storage can be blocked or absent (SSR). */
interface TypedStorage {
    /** Reads and restores the value kept under `id`, or `undefined`. */
    readonly get: <T>(id: StorageId) => T | undefined
    /** Serializes and keeps `value` under `id`; answers false when the browser refused. */
    readonly set: (id: StorageId, value: unknown) => boolean
    /** Forgets `id`; answers false when the browser refused. */
    readonly remove: (id: StorageId) => boolean
}

const areaOf = (area: "localStorage" | "sessionStorage"): Storage | undefined => {
    try {
        return typeof window === "undefined" ? undefined : window[area]
    } catch {
        return undefined
    }
}

const storageOf = (area: "localStorage" | "sessionStorage"): TypedStorage => ({
    get: <T>(id: StorageId): T | undefined => {
        try {
            const text = areaOf(area)?.getItem(id)
            return text === null || text === undefined ? undefined : deserialize<T>(text)
        } catch {
            return undefined
        }
    },
    set: (id, value) => {
        try {
            areaOf(area)?.setItem(id, serialize(value))
            return true
        } catch {
            return false
        }
    },
    remove: (id) => {
        try {
            areaOf(area)?.removeItem(id)
            return true
        } catch {
            return false
        }
    },
})

/** Persistent browser storage. */
export const LocalStorage: TypedStorage = storageOf("localStorage")

const YEAR_SECONDS = 60 * 60 * 24 * 365

/** Remembers the active workspace in the cookie the server-rendered pages read; the server still checks the membership. */
export const rememberWorkspaceCookie = (workspaceId: string): void => {
    document.cookie = `${WORKSPACE_COOKIE}=${encodeURIComponent(workspaceId)}; path=/; max-age=${YEAR_SECONDS}; samesite=lax`
}
