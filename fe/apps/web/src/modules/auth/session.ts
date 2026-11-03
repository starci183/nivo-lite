import type { AuthListener } from "@starci/auth/client"
import { auth } from "./client"

/** Refreshes through the httpOnly cookie and answers the new access token (`undefined` when it cannot be refreshed). Overlapping calls share one refresh. */
export const renewSessionToken = (): Promise<string | undefined> => auth.renew()

/** The access token of the current session, refreshed when missing or about to expire; `undefined` when signed out. */
export const sessionAccessToken = (): Promise<string | undefined> => auth.accessToken()

/** The signed-in person (id and e-mail), or `null` when signed out. */
export const sessionUser = (): Promise<{ readonly id: string; readonly email: string } | null> => auth.user()

/** Calls `onChange` with the event and the id of the person the session belongs to (`null` when signed out) on every sign-in, sign-out and token refresh, and answers the function that stops listening. The first answer comes from a refresh. */
export const subscribeToAuthChange = (onChange: AuthListener): (() => void) => auth.subscribe(onChange)
