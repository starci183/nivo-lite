"use server"
import "server-only"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { WORKSPACE_COOKIE } from "@/lib/session"
import { sessionCookieOptions } from "@/modules/config"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { dbFailure, dbOk } from "../outcome"
import type { DbOutcome } from "../outcome"
import { inviteFailureCode, inviteTokenSchema } from "./invite.mapper"

const YEAR_SECONDS = 60 * 60 * 24 * 365

/**
 * Accepts an invitation as the signed-in person. The database checks the token, expiry, revocation and that the e-mails match;
 * its error message becomes the failure code. The joined workspace becomes the current one.
 */
export const writeAcceptInvite = async (token: string): Promise<DbOutcome<{ readonly workspaceId: string }>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "anonymous")
    const parsed = inviteTokenSchema.safeParse(token)
    if (!parsed.success) return dbFailure("invalid", "invite_invalid")
    const client = await createServerDbClient()
    const { data, error } = await client.rpc("accept_invite", { token: parsed.data })
    if (error !== null) {
        const code = inviteFailureCode(error.message)
        return dbFailure(code === "invite_failed" ? "unavailable" : "invalid", code)
    }
    ;(await cookies()).set(WORKSPACE_COOKIE, data, {
        ...sessionCookieOptions,
        path: "/",
        httpOnly: true,
        maxAge: YEAR_SECONDS,
    })
    revalidatePath("/", "layout")
    return dbOk({ workspaceId: data })
}
