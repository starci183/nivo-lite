import { authClient } from "./client"

/** The access token of the current browser session, or `undefined` when signed out. */
export const sessionAccessToken = async (): Promise<string | undefined> => {
    const { data } = await authClient().auth.getSession()
    return data.session?.access_token
}

/** The signed-in person of the browser session (id and e-mail), or `null` when signed out. */
export const sessionUser = async (): Promise<{ readonly id: string; readonly email: string } | null> => {
    const { data } = await authClient().auth.getSession()
    const user = data.session?.user
    return user === undefined ? null : { id: user.id, email: user.email ?? "" }
}

let inFlight: Promise<string | undefined> | undefined

/** Refreshes the session and answers the new access token (`undefined` when it cannot be refreshed). Overlapping calls share one refresh. */
export const renewSessionToken = (): Promise<string | undefined> => {
    inFlight ??= authClient()
        .auth.refreshSession()
        .then(({ data }) => data.session?.access_token)
        .finally(() => {
            inFlight = undefined
        })
    return inFlight
}

/** Calls `onChange` with the event name and the id of the person the session now belongs to (`null` when signed out) on every sign-in, sign-out and token refresh, and answers the function that stops listening. */
export const subscribeToAuthChange = (onChange: (event: string, userId: string | null) => void): (() => void) => {
    const listener = authClient().auth.onAuthStateChange((event, session) => onChange(event, session?.user.id ?? null))
    return () => listener.data.subscription.unsubscribe()
}
