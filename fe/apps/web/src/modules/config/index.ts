/** The only process-environment reader of the web app's modules. */
const required = (name: string, value: string | undefined): string => {
    if (value === undefined || value === "")
        throw new Error(`${name} is not set (provide it as a build argument / GitHub environment variable)`)
    return value
}

/** The public Supabase project origin. */
export const supabaseUrl = (): string => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL)
/** The public anonymous key; RLS remains the authority for every request. */
export const supabaseAnonKey = (): string =>
    required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
/** The origin of the public API the Developers page documents; the web app itself never calls it. */
export const developerApiUrl = (): string =>
    required("NEXT_PUBLIC_DEVELOPER_API_URL", process.env.NEXT_PUBLIC_DEVELOPER_API_URL)

/**
 * Security attributes applied whenever the app writes a Supabase session cookie. `httpOnly` is false on purpose: the browser
 * client (realtime, auth lifecycle, the realtime token) reads the session from this cookie.
 */
export const sessionCookieOptions = {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
} as const

/** The origin of the back end api the browser calls directly (GraphQL at `/graphql`, REST beside it). */
const apiUrl = (): string => required("NEXT_PUBLIC_API_URL", process.env.NEXT_PUBLIC_API_URL)
/** The GraphQL endpoint of the back end api. */
export const graphqlUrl = (): string => `${apiUrl()}/graphql`

/** Transport tuning of the GraphQL client: request timeout and the retry backoff (milliseconds, attempts). */
export const graphqlTuning = {
    timeoutMs: 30_000,
    retryInitialDelayMs: 300,
    retryMaxDelayMs: 3_000,
    retryMaxAttempts: 3,
} as const

/** The public origin of the landing site (privacy and terms live there, not in the console). */
export const landingUrl = (): string => {
    const value = required("NEXT_PUBLIC_LANDING_URL", process.env.NEXT_PUBLIC_LANDING_URL)
    let end = value.length
    while (value[end - 1] === "/") end -= 1
    return value.slice(0, end)
}

/** The public origin of the site (providers call back to it); `undefined` when it is not set. */
export const webSiteOrigin = (): string | undefined => process.env.NEXT_PUBLIC_SITE_URL

export { creditsContactHref } from "./credits"
