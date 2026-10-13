import "server-only"

import type { EmailOtpType } from "@supabase/supabase-js"
import type { NextRequest, NextResponse } from "next/server"
import { principalFromClaims } from "../principal"
import type { Principal } from "../principal"
import { createRequestDbClient, createServerDbClient } from "../server"
import { dbFailure, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"

const EMAIL_LINK_TYPES: readonly EmailOtpType[] = ["signup", "recovery", "invite", "email_change", "magiclink", "email"]

const emailLinkTypeOf = (value: string): EmailOtpType | undefined => EMAIL_LINK_TYPES.find((type) => type === value)

/** Exchanges the one-time PKCE code and lets the server client write the resulting cookies. */
export const exchangeAuthCode = async (code: string) => {
    const client = await createServerDbClient()
    return toOutcome(await client.auth.exchangeCodeForSession(code))
}

/** Verifies an e-mail link (token hash and kind) and lets the server client write the resulting cookies. */
export const verifyEmailLink = async (type: string, tokenHash: string) => {
    const linkType = emailLinkTypeOf(type)
    if (linkType === undefined) return dbFailure("invalid", "link-type")
    const client = await createServerDbClient()
    return toOutcome(await client.auth.verifyOtp({ type: linkType, token_hash: tokenHash }))
}

/** Refreshes proxy cookies through `getClaims()` and returns the verified principal outcome. */
export const refreshSession = async (request: NextRequest, response: NextResponse): Promise<DbOutcome<Principal>> => {
    const client = createRequestDbClient(request, response)
    const claims = toOutcome(await client.auth.getClaims())
    if (claims.kind !== "ok") return claims
    return principalFromClaims(claims.value.claims)
}
