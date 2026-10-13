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
