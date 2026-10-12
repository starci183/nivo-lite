import "server-only"

import type { NextRequest, NextResponse } from "next/server"
import { getPrincipal, principalFromClaims } from "../principal"
import type { Principal } from "../principal"
import { createRequestDbClient } from "../server"
import { toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"

/** Reads the verified principal of the current server request. */
export const readSession = (): Promise<DbOutcome<Principal>> => getPrincipal()

/** Refreshes proxy cookies through `getClaims()` and returns the verified principal outcome. */
export const refreshSession = async (request: NextRequest, response: NextResponse): Promise<DbOutcome<Principal>> => {
    const client = createRequestDbClient(request, response)
    const claims = toOutcome(await client.auth.getClaims())
    if (claims.kind !== "ok") return claims
    return principalFromClaims(claims.value.claims)
}
