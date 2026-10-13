import { authClient } from "./client"

/** The access token of the current browser session, or `undefined` when signed out. */
export const sessionAccessToken = async (): Promise<string | undefined> => {
    const { data } = await authClient().auth.getSession()
    return data.session?.access_token
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

/** Calls `onChange` with the event name on every sign-in, sign-out and token refresh and answers the function that stops listening. */
export const subscribeToAuthChange = (onChange: (event: string) => void): (() => void) => {
    const listener = authClient().auth.onAuthStateChange((event) => onChange(event))
    return () => listener.data.subscription.unsubscribe()
}
