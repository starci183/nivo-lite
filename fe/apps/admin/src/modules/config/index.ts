/** The only process-environment reader of the admin app's modules. */
const required = (name: string, value: string | undefined): string => {
    if (value === undefined || value === "")
        throw new Error(`${name} is not set (provide it as a build argument / GitHub environment variable)`)
    return value
}

/** Drops the trailing slashes of an origin. */
const withoutTrailingSlash = (value: string): string => {
    let end = value.length
    while (value[end - 1] === "/") end -= 1
    return value.slice(0, end)
}

/** True when the console is opened on a host of the local machine: the browser then reaches the local api, whose cookie is same-site there. */
const onLocalHost = (): boolean =>
    typeof window !== "undefined" && ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname)

/**
 * The origin of the back end api the browser calls directly (GraphQL at `/graphql`) and whose auth doors modules/auth calls. A dev stack
 * served through a tunnel sets NEXT_PUBLIC_LOCAL_API_URL too: the admin opened on localhost keeps its local api (the refresh cookie stays
 * same-site), the admin opened on the tunnel origin calls the tunnel api.
 */
export const apiUrl = (): string => {
    const local = process.env.NEXT_PUBLIC_LOCAL_API_URL
    if (local !== undefined && local !== "" && onLocalHost()) return local
    return required("NEXT_PUBLIC_API_URL", process.env.NEXT_PUBLIC_API_URL)
}

/** The GraphQL endpoint of the back end api. */
export const graphqlUrl = (): string => `${apiUrl()}/graphql`

/** Transport tuning of the GraphQL client: request timeout and the retry backoff (milliseconds, attempts). */
export const graphqlTuning = {
    timeoutMs: 30_000,
    retryInitialDelayMs: 300,
    retryMaxDelayMs: 3_000,
    retryMaxAttempts: 3,
} as const

/** The public origin of this app, the base of its document metadata. */
export const adminSiteOrigin = (): string => required("NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL)

/** The public origin of the customer console, where a person signs in and where everyone the admin does not know is sent. */
export const consoleUrl = (): string => withoutTrailingSlash(required("NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL))

/** The sign-in page of the console. */
export const consoleLoginUrl = (): string => `${consoleUrl()}/login`
