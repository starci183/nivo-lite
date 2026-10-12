import "server-only"

import { createServerDbClient } from "../server"
import { toOutcome } from "../outcome"

/** Exchanges the one-time PKCE code and lets the server client write the resulting cookies. */
export const writeExchangeCode = async (code: string) => {
    const client = await createServerDbClient()
    return toOutcome(await client.auth.exchangeCodeForSession(code))
}
