import "server-only"

import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { parseUserAgent, providersOf, sessionIdOf } from "./account.mapper"
import type { Device } from "./account.mapper"

/** One signed-in device of the account. */
export interface DeviceSession {
    readonly id: string
    readonly device: Device
    readonly ip: string | null
    /** When the session was created, ISO 8601. */
    readonly createdAt: string | null
    /** When it was last active, ISO 8601. */
    readonly lastActiveAt: string | null
    readonly isCurrent: boolean
}

/** Everything the account page draws. */
export interface AccountFacts {
    readonly name: string
    readonly email: string
    /** The identity providers linked to the account (`google`, `email`). */
    readonly providers: ReadonlyArray<string>
    readonly sessions: ReadonlyArray<DeviceSession>
    /** True when the device list could not be read; the rest of the page still draws. */
    readonly sessionsFailed: boolean
}

/** Reads the signed-in account: profile, linked sign-in methods and the devices signed in, current one first. */
export const readAccount = async (): Promise<DbOutcome<AccountFacts>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return principal
    const client = await createServerDbClient()
    const user = toOutcome(await client.auth.getUser())
    if (user.kind !== "ok") return user
    const authUser = user.value.user
    if (authUser === null) return dbFailure("refused", "user")
    const claims = toOutcome(await client.auth.getClaims())
    if (claims.kind !== "ok") return dbFailure(claims.kind, claims.code)
    const currentId = sessionIdOf(claims.value.claims)
    const rows = toOutcome(await client.rpc("my_sessions"))
    const email = authUser.email ?? ""
    const sessions = rows.kind === "ok" ? rows.value : []
    return dbOk({
        name: principal.value.metadata.full_name ?? principal.value.metadata.name ?? email.split("@")[0] ?? "",
        email,
        providers: providersOf(authUser.identities),
        sessions: sessions
            .map((row): DeviceSession => ({
                id: row.id,
                device: parseUserAgent(row.user_agent),
                ip: row.ip,
                createdAt: row.created_at,
                lastActiveAt: row.last_active_at,
                isCurrent: row.id === currentId,
            }))
            .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent)),
        sessionsFailed: rows.kind !== "ok",
    })
}
