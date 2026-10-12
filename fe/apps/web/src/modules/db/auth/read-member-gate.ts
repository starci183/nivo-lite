import "server-only"

import type { NextRequest, NextResponse } from "next/server"
import { sessionCookieOptions } from "@/modules/config"
import { createRequestDbClient } from "../server"
import { toOutcome } from "../outcome"

/** Whether the signed-in person still has an enabled seat in at least one workspace. */
export type MemberGate = "ok" | "off"

const GATE_COOKIE = "nivo_member_gate" // "<userId>.<ok|off>": short-lived cache of the membership check
const GATE_TTL_SECONDS = 60
const MEMBERSHIP_LIMIT = 100

const cachedGate = (request: NextRequest, userId: string): MemberGate | undefined => {
    const cached = request.cookies.get(GATE_COOKIE)?.value
    if (!cached?.startsWith(`${userId}.`)) return undefined
    return cached.endsWith(".off") ? "off" : "ok"
}

/**
 * Reads the member gate: a person whose every membership is disabled loses access at once. Under RLS the person sees only their own
 * membership rows. A failed lookup (for example a schema not migrated yet) fails open and is not cached.
 */
export const readMemberGate = async (
    request: NextRequest,
    response: NextResponse,
    userId: string,
): Promise<MemberGate> => {
    const cached = cachedGate(request, userId)
    if (cached !== undefined) return cached
    const client = createRequestDbClient(request, response)
    const rows = toOutcome(
        await client.from("workspace_members").select("status").eq("user_id", userId).limit(MEMBERSHIP_LIMIT),
    )
    if (rows.kind !== "ok") return "ok"
    const gate = rows.value.length > 0 && rows.value.every((row) => row.status === "disabled") ? "off" : "ok"
    response.cookies.set(GATE_COOKIE, `${userId}.${gate}`, {
        ...sessionCookieOptions,
        maxAge: GATE_TTL_SECONDS,
        path: "/",
        httpOnly: true,
    })
    return gate
}

/** Ends the session of a person the gate turned away: signs out locally and forgets the cached verdict. */
export const endGatedSession = async (request: NextRequest, response: NextResponse): Promise<void> => {
    const client = createRequestDbClient(request, response)
    const ended = await client.auth.signOut({ scope: "local" })
    if (ended.error !== null) return
    response.cookies.set(GATE_COOKIE, "", { ...sessionCookieOptions, maxAge: 0, path: "/", httpOnly: true })
}
