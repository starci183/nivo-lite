/** The only process-environment reader of the web app's modules. */
const required = (name: string, value: string | undefined): string => {
    if (value === undefined || value === "") throw new Error(`${name} is not set (see secrets.example.env)`)
    return value
}

/** The public origin used for metadata and same-origin redirects. */
export const siteUrl = (): string => required("NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL)
/** The public Supabase project origin. */
export const supabaseUrl = (): string => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL)
/** The public anonymous key; RLS remains the authority for every request. */
export const supabaseAnonKey = (): string =>
    required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
/** The origin of the back end api that receives the user's access token. */
export const apiUrl = (): string => required("NEXT_PUBLIC_API_URL", process.env.NEXT_PUBLIC_API_URL)

/**
 * Security attributes applied whenever the app writes a Supabase session cookie. The cookie stays readable by the browser
 * client because realtime and the client auth lifecycle read the session from it.
 */
export const sessionCookieOptions = {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
} as const
