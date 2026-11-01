/** The only process-environment reader of the web app's modules. */
const required = (name: string, value: string | undefined): string => {
    if (value === undefined || value === "")
        throw new Error(`${name} is not set (provide it as a build argument / GitHub environment variable)`)
    return value
}

/** The origin of the public API the Developers page documents; the web app itself never calls it. */
export const developerApiUrl = (): string =>
    required("NEXT_PUBLIC_DEVELOPER_API_URL", process.env.NEXT_PUBLIC_DEVELOPER_API_URL)

/** Security attributes applied to the cookies the web app itself writes (the locale cookie). The session cookie belongs to the back end. */
export const sessionCookieOptions = {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
} as const

/** The origin of the back end api the browser calls directly (GraphQL at `/graphql`, REST beside it). */
export const apiOrigin = (): string => required("NEXT_PUBLIC_API_URL", process.env.NEXT_PUBLIC_API_URL)
/** The GraphQL endpoint of the back end api. */
export const graphqlUrl = (): string => `${apiOrigin()}/graphql`
/** The back end's event-stream endpoint at `path`, on the origin of its GraphQL endpoint (the streams of modules/api/sse). */
export const eventStreamUrl = (path: string): string => new URL(path, graphqlUrl()).href

/** Transport tuning of the GraphQL client: request timeout and the retry backoff (milliseconds, attempts). */
export const graphqlTuning = {
    timeoutMs: 30_000,
    retryInitialDelayMs: 300,
    retryMaxDelayMs: 3_000,
    retryMaxAttempts: 3,
} as const

/** The landing origin of the local stack (the dev compose names it), used when a development run leaves the variable unset. */
const LOCAL_LANDING_ORIGIN = "http://landing.localhost"

/** The public origin of the landing site (privacy and terms live there, not in the console). A production build must set it; a development run falls back to the local landing. */
export const landingUrl = (): string => {
    const configured = process.env.NEXT_PUBLIC_LANDING_URL
    const value =
        process.env.NODE_ENV !== "production" && (configured === undefined || configured === "")
            ? LOCAL_LANDING_ORIGIN
            : required("NEXT_PUBLIC_LANDING_URL", configured)
    let end = value.length
    while (value[end - 1] === "/") end -= 1
    return value.slice(0, end)
}

/** The public origin of the site (providers call back to it); `undefined` when it is not set. */
export const webSiteOrigin = (): string | undefined => process.env.NEXT_PUBLIC_SITE_URL

/** The public settings of Google Picker: a browser API key and the OAuth client id of the console; `null` when either is unset, which hides the Picker. */
export const googlePickerSettings = (): { readonly apiKey: string; readonly clientId: string } | null => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    return apiKey === undefined || apiKey === "" || clientId === undefined || clientId === ""
        ? null
        : { apiKey, clientId }
}

export { creditsContactHref } from "./credits"
