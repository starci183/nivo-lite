/** The only process-environment reader of the web app's modules. */
const required = (name: string, value: string | undefined): string => {
    if (value === undefined || value === "") throw new Error(`${name} is not set (see secrets.example.env)`)
    return value
}

/** The public Supabase project origin. */
export const supabaseUrl = (): string => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL)
/** The public anonymous key; RLS remains the authority for every request. */
export const supabaseAnonKey = (): string =>
    required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
/** The origin of the back end api that receives the user's access token. */
export const apiUrl = (): string => required("NEXT_PUBLIC_API_URL", process.env.NEXT_PUBLIC_API_URL)
/** The longest an api request may take before the client aborts it. */
export const API_TIMEOUT_MS = 15_000

/**
 * Security attributes applied whenever the app writes a Supabase session cookie. `httpOnly` is false on purpose: the browser
 * client (realtime, auth lifecycle, the access token sent to the api) reads the session from this cookie.
 */
export const sessionCookieOptions = {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
} as const
