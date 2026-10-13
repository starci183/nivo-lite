import "server-only"

import { safeNext } from "./auth.mapper"
import { readRequestOrigin } from "./read-request-origin"

/** Where an e-mail link sends the person: the request origin, the safe destination and the /auth/confirm URL that carries it. */
export interface ConfirmTarget {
    readonly origin: string
    /** The safe destination, "/" when none was given. */
    readonly next: string
    readonly url: string
}

/** E-mail links come back through /auth/confirm, which turns the token (or PKCE code) into a session first. */
export const readConfirmTarget = async (rawNext: string | undefined): Promise<ConfirmTarget | undefined> => {
    const origin = await readRequestOrigin()
    if (origin === undefined) return undefined
    const next = safeNext(rawNext, origin) ?? "/"
    return { origin, next, url: `${origin}/auth/confirm?next=${encodeURIComponent(next)}` }
}
