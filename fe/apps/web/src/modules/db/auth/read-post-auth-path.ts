import "server-only"

import { createServerDbClient } from "../server"
import { toOutcome } from "../outcome"
import { safeNext } from "./auth.mapper"

/** Where a person with no workspace goes first: they pick a plan and open one there. */
const ONBOARDING_PATH = "/workspaces"
/** Where a person with a workspace lands. */
const CONSOLE_PATH = "/dashboard"

/**
 * The page to open right after a session was created. An explicit safe `next` (an invite page, a deep link) always wins.
 * Otherwise a person with any membership goes to the dashboard and a person with none to /workspaces. A failed lookup
 * falls back to the dashboard, which gates by itself. Membership is read under RLS, so the person sees only their own rows.
 */
export const readPostAuthPath = async (rawNext: string | null | undefined, origin: string): Promise<string> => {
    const explicit = safeNext(rawNext, origin)
    if (explicit !== undefined) return explicit
    const client = await createServerDbClient()
    const user = toOutcome(await client.auth.getUser())
    if (user.kind !== "ok" || user.value.user === null) return CONSOLE_PATH
    const rows = toOutcome(
        await client.from("workspace_members").select("status").eq("user_id", user.value.user.id).limit(1),
    )
    if (rows.kind !== "ok") return CONSOLE_PATH
    return rows.value.length > 0 ? CONSOLE_PATH : ONBOARDING_PATH
}
