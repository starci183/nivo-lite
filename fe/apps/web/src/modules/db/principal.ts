import "server-only"

import { cache } from "react"
import { createServerDbClient } from "./server"
import { dbFailure, dbOk, toOutcome } from "./outcome"
import type { DbOutcome } from "./outcome"

/** The profile fields Supabase Auth keeps on the user (display name, avatar). */
export interface PrincipalMetadata {
    readonly full_name?: string
    readonly name?: string
    readonly avatar_url?: string
}

/** The trusted caller claims exposed to server readers and writers. */
export interface Principal {
    readonly id: string
    readonly email?: string
    readonly metadata: PrincipalMetadata
}

/** One string claim of the user metadata as a single-key object, or nothing. */
const textOf = (source: unknown, key: string): { [name: string]: string } => {
    if (typeof source !== "object" || source === null) return {}
    const value = Object.entries(source).find(([name]) => name === key)?.[1]
    return typeof value === "string" ? { [key]: value } : {}
}

/** Keeps only the claims a consumer may trust after `getClaims()` verified the token. */
export const principalFromClaims = (claims: Readonly<Record<string, unknown>>): DbOutcome<Principal> => {
    if (typeof claims.sub !== "string") return dbFailure("refused", "claims")
    return dbOk({
        id: claims.sub,
        ...(typeof claims.email === "string" ? { email: claims.email } : {}),
        metadata: {
            ...textOf(claims.user_metadata, "full_name"),
            ...textOf(claims.user_metadata, "name"),
            ...textOf(claims.user_metadata, "avatar_url"),
        },
    })
}

/** Verifies and memoizes the current request principal. */
export const getPrincipal = cache(async (): Promise<DbOutcome<Principal>> => {
    const client = await createServerDbClient()
    const claims = toOutcome(await client.auth.getClaims())
    if (claims.kind !== "ok") return claims
    return principalFromClaims(claims.value.claims)
})
