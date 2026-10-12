"use server"
import "server-only"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { WORKSPACE_COOKIE } from "@/lib/session"
import { sessionCookieOptions } from "@/modules/config"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"

const WORKSPACE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

const YEAR_SECONDS = 60 * 60 * 24 * 365

/** Makes a workspace the current one (cookie), only when the caller is an active member of it under RLS. */
export const writeSwitchWorkspace = async (workspaceId: string): Promise<DbOutcome<true>> => {
    if (!WORKSPACE_ID.test(workspaceId)) return dbFailure("invalid", "workspace-id")
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return principal
    const client = await createServerDbClient()
    const member = toOutcome(
        await client
            .from("workspace_members")
            .select("workspace_id")
            .eq("user_id", principal.value.id)
            .eq("workspace_id", workspaceId)
            .eq("status", "active")
            .maybeSingle(),
    )
    if (member.kind !== "ok") return member
    ;(await cookies()).set(WORKSPACE_COOKIE, workspaceId, {
        ...sessionCookieOptions,
        path: "/",
        httpOnly: true,
        maxAge: YEAR_SECONDS,
    })
    revalidatePath("/", "layout")
    return dbOk(true)
}
