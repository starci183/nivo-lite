import { authClient } from "@/modules/auth"
import type { AuthSession } from "@/modules/auth"

/** The signed-in person as the console reads it: the id and the address (empty when the account has none). */
export interface SessionPerson {
    readonly id: string
    readonly email: string
}

const personOf = (session: AuthSession | undefined): SessionPerson | null =>
    session === undefined ? null : { id: session.userId, email: session.email ?? "" }

/** Refreshes through the httpOnly cookie and answers the new access token (`undefined` when it cannot be refreshed). Overlapping calls share one refresh. */
export const renewSessionToken = (): Promise<string | undefined> => authClient.refreshAccessToken()

/** The access token of the current session, refreshed when missing or about to expire; `undefined` when signed out. */
export const sessionAccessToken = (): Promise<string | undefined> => authClient.accessToken()

/** The signed-in person (id and e-mail), or `null` when signed out. */
export const sessionUser = async (): Promise<SessionPerson | null> => personOf(await authClient.session())

/** Calls `onChange` with the id of the person the session belongs to (`null` when signed out) on every sign-in, sign-out and token refresh, and answers the function that stops listening. The first answer comes from a refresh. */
export const subscribeToAuthChange = (onChange: (userId: string | null) => void): (() => void) =>
    authClient.onChange((session) => {
        onChange(personOf(session)?.id ?? null)
    })
