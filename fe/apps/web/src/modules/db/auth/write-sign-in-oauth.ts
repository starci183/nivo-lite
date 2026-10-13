"use server"
import "server-only"

import { APP_ROUTES } from "@/modules/routes"
import { createServerDbClient } from "../server"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { safeNext } from "./auth.mapper"
import { readRequestOrigin } from "./read-request-origin"

/** Starts a Google sign-in: returns the provider URL for the browser to open; the return trip lands on /auth/callback. */
export const writeSignInOAuth = async (next: string | undefined): Promise<DbOutcome<{ readonly url: string }>> => {
    const origin = await readRequestOrigin()
    if (origin === undefined) return dbFailure("unavailable", "origin")
    const safe = safeNext(next, origin)
    const redirectTo = `${origin}${APP_ROUTES.authCallback}${safe === undefined ? "" : `?next=${encodeURIComponent(safe)}`}`
    const client = await createServerDbClient()
    const started = toOutcome(
        await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo, skipBrowserRedirect: true } }),
    )
    if (started.kind !== "ok") return started
    return started.value.url === null ? dbFailure("unavailable", "oauth-url") : dbOk({ url: started.value.url })
}
